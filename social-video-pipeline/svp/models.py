"""Společný datový model: jedna „položka“ = jeden záběr ve videu."""

from dataclasses import asdict, dataclass, field


@dataclass
class Item:
    id: str                      # stabilní id (QID nebo rok+slug)
    title: str                   # název místa / události
    facts: str                   # ověřený text ze zdroje (Wikipedie)
    image_url: str               # URL obrázku (Commons / Wikipedie)
    source_url: str              # odkaz na článek – kvůli dohledatelnosti
    year: int | None = None      # pro formát „Den v historii“
    coord: tuple | None = None   # (lat, lon) pro formát „Místa“
    credit: dict = field(default_factory=dict)  # autor + licence obrázku
    image_path: str = ""         # lokální oříznutý obrázek 9:16
    clip_path: str = ""          # lokální videoklip

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_dict(cls, data):
        data = dict(data)
        if data.get("coord") is not None:
            data["coord"] = tuple(data["coord"])
        return cls(**data)
