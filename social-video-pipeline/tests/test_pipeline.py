"""Celý běh offline: ffmpeg obrázky a klipy, šablonový scénář, balíček pro MPT."""

import json
import os
import shutil
import tempfile
import unittest
from unittest import mock

from svp import media, pipeline, script
from svp.models import Item

FACTS = ("Zřícenina hradu Rabštejn stojí nad údolím říčky. Hrad byl založen ve 13. století. "
         "Dnes je volně přístupný.")


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def make_items(src_image, n=3):
    return [Item(id=f"Q{i}", title=f"Místo {i}", facts=FACTS, image_url=src_image,
                 source_url="https://cs.wikipedia.org/wiki/X",
                 credit={"artist": "Jan Novák", "license": "CC BY-SA 4.0"}) for i in range(n)]


class PipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.src = os.path.join(cls.tmp, "src.jpg")
        # fotka na šířku, jako většina snímků památek
        media.run_ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=1600x1000", "-frames:v", "1", cls.src])

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def test_prepare_image_is_9_16(self):
        for fit in ("blur", "cover"):
            dest = os.path.join(self.tmp, f"{fit}.jpg")
            media.prepare_image(self.src, dest, fit=fit)
            out = media.subprocess.run(
                ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                 "stream=width,height", "-of", "csv=p=0", dest], capture_output=True, text=True)
            self.assertEqual(out.stdout.strip(), "768,1344")

    def test_fit_clip_length_extends_short_clip(self):
        short = os.path.join(self.tmp, "short.mp4")
        media.run_ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=768x1344:rate=24", "-t", "2",
                          "-pix_fmt", "yuv420p", short])
        dest = os.path.join(self.tmp, "fitted.mp4")
        media.fit_clip_length(short, dest, 5.5)
        self.assertAlmostEqual(media.probe_duration(dest), 5.5, delta=0.15)

    def test_template_script_validates(self):
        items = make_items(self.src)
        s = script.template_script("places", items)
        self.assertTrue(script.validate(s, items))
        self.assertIn("3 míst", s["hook"])
        self.assertNotIn("(", s["segments"][0]["narration"])

    def test_validate_rejects_missing_segment(self):
        items = make_items(self.src)
        s = script.template_script("places", items)
        s["segments"].pop()
        self.assertFalse(script.validate(s, items))

    def test_extract_json_from_fenced_answer(self):
        self.assertEqual(script.extract_json('```json\n{"a": 1}\n```'), {"a": 1})

    def test_full_run_offline(self):
        items = make_items(self.src)
        mpt_dir = os.path.join(self.tmp, "mpt")
        with mock.patch("svp.http.download", side_effect=lambda url, dest, **kw: shutil.copy(url, dest)):
            out = pipeline.run("places", items, os.path.join(self.tmp, "out"), context="test",
                               motion="kenburns", llm=False, mpt_dir=mpt_dir, log=lambda *_: None)

        req = json.loads(read(os.path.join(out, "mpt_request.json")))
        self.assertEqual(req["video_source"], "local")
        self.assertEqual(req["video_concat_mode"], "sequential")
        self.assertEqual(len(req["video_materials"]), 3)
        for mat in req["video_materials"]:
            self.assertTrue(os.path.exists(os.path.join(mpt_dir, "storage", "local_videos", mat["url"])))
        # každý klip musí být aspoň tak dlouhý, jak MPT čeká
        for n, mat in enumerate(req["video_materials"], 1):
            dur = media.probe_duration(os.path.join(out, "clips", f"{n:02d}.mp4"))
            self.assertGreaterEqual(dur + 1, mat["duration"])
        credits = read(os.path.join(out, "popisek_a_zdroje.txt"))
        self.assertIn("Jan Novák, CC BY-SA 4.0", credits)
        self.assertTrue(os.path.exists(os.path.join(out, "narration.txt")))


if __name__ == "__main__":
    unittest.main()
