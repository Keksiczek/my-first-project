"""Testy parserů nad ukázkovými odpověďmi API (tvar odpovídá dokumentaci Wikimedia)."""

import unittest

from svp.sources import history, places, wiki


class WikiTests(unittest.TestCase):
    def test_commons_filename(self):
        self.assertEqual(
            wiki.commons_filename("http://commons.wikimedia.org/wiki/Special:FilePath/Hrad%20Helfštýn.jpg"),
            "Hrad Helfštýn.jpg")
        self.assertEqual(
            wiki.commons_filename("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/1280px-X.jpg"),
            "X.jpg")
        self.assertEqual(
            wiki.commons_filename("https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg"), "X.jpg")

    def test_first_sentences_keeps_abbreviations(self):
        text = ("Kostel sv. Václava stojí na kopci (ve výšce 500 m). Byl postaven roku 1350. "
                "Třetí věta se nevejde.")
        self.assertEqual(wiki.first_sentences(text, n=2),
                         "Kostel sv. Václava stojí na kopci. Byl postaven roku 1350.")

    def test_parse_imageinfo(self):
        data = {"query": {"pages": {"1": {"imageinfo": [{
            "thumburl": "https://upload.wikimedia.org/thumb.jpg",
            "descriptionurl": "https://commons.wikimedia.org/wiki/File:X.jpg",
            "extmetadata": {"Artist": {"value": "<a href='x'>Jan Novák</a>"},
                            "LicenseShortName": {"value": "CC BY-SA 4.0"}}}]}}}}
        info = wiki.parse_imageinfo(data)
        self.assertEqual(info["artist"], "Jan Novák")
        self.assertEqual(info["license"], "CC BY-SA 4.0")
        self.assertEqual(info["thumb_url"], "https://upload.wikimedia.org/thumb.jpg")


class PlacesTests(unittest.TestCase):
    def row(self, qid, label, sitelinks):
        return {
            "item": {"value": f"http://www.wikidata.org/entity/{qid}"},
            "itemLabel": {"value": label},
            "image": {"value": f"http://commons.wikimedia.org/wiki/Special:FilePath/{qid}.jpg"},
            "coord": {"value": "Point(17.25 49.59)"},
            "article": {"value": f"https://cs.wikipedia.org/wiki/{label.replace(' ', '_')}"},
            "sitelinks": {"value": str(sitelinks)},
        }

    def test_parse_sparql_dedupes_and_parses(self):
        data = {"results": {"bindings": [self.row("Q1", "Hrad Šternberk", 5),
                                         self.row("Q1", "Hrad Šternberk", 5)]}}
        rows = places.parse_sparql(data)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["coord"], (49.59, 17.25))
        self.assertEqual(rows[0]["article_title"], "Hrad Šternberk")

    def test_pick_skips_most_famous(self):
        cands = [{"qid": f"Q{i}", "sitelinks": i} for i in range(1, 31)]
        picked = places.pick_candidates(cands, count=5, seed=1)
        self.assertTrue(all(c["sitelinks"] <= 20 for c in picked))

    def test_query_contains_types(self):
        q = places.build_query("Q23413", "Q213")
        self.assertIn("wd:Q23413", q)
        self.assertIn("wd:Q213", q)
        self.assertIn("cs.wikipedia.org", q)


CS_DAY = """
'''9. říjen''' je 282. den roku.

== Události ==
=== Česko ===
* [[1918]] – V [[Praha|Praze]] byla založena [[Česká akademie|akademie]].<ref>Zdroj</ref>
** vnořený řádek bez roku
* 1945 – [[Karel Novák]] dokončil stavbu.
=== Svět ===
* [[1604]] – Pozorována [[Keplerova supernova]].
* [[480 př. n. l.]] – nezpracovatelný řádek

== Narození ==
* [[1940]] – [[John Lennon]], hudebník
"""


class HistoryTests(unittest.TestCase):
    def test_parse_cs_day(self):
        events = history.parse_cs_day(CS_DAY)
        self.assertEqual([e["year"] for e in events], [1918, 1945, 1604])
        self.assertEqual(events[0]["region"], "Česko")
        self.assertEqual(events[0]["text"], "V Praze byla založena akademie.")
        self.assertEqual(events[0]["links"][0], "Praha")
        self.assertEqual(events[2]["region"], "Svět")

    def test_pick_events_prefers_region_and_sorts(self):
        events = [{"year": y, "region": r, "text": "", "links": []}
                  for y, r in [(1918, "Česko"), (1604, "Svět"), (1945, "Česko"), (1066, "Svět")]]
        picked = history.pick_events(events, 2, "Česko", seed=0)
        self.assertEqual([e["year"] for e in picked], [1918, 1945])

    def test_cs_date(self):
        self.assertEqual(history.cs_date(10, 9), "9. října")
        self.assertEqual(history.cs_day_title(10, 9), "9. říjen")

    def test_parse_feed(self):
        data = {"events": [{"year": 1604, "text": "Supernova", "pages": [
            {"titles": {"normalized": "Kepler's Supernova"},
             "originalimage": {"source": "https://upload.wikimedia.org/a.jpg"},
             "extract": "A supernova.",
             "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/K"}}}]}]}
        ev = history.parse_feed(data)[0]
        self.assertEqual(ev["image"], "https://upload.wikimedia.org/a.jpg")
        self.assertEqual(ev["links"], ["Kepler's Supernova"])


if __name__ == "__main__":
    unittest.main()
