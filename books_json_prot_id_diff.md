# books.json prot_id 字段 diff

## 规则
- 新教也有的书：`prot_id` = 新教对应 ID（旧约 1-39，新约 40-66）
- Deutero 书（新教没有）：`prot_id` = `null`

## 每本书的 prot_id

```
ID 1  → prot_id: 1   (创世纪/Genesis)
ID 2  → prot_id: 2   (出谷纪/Exodus)
ID 3  → prot_id: 3   (肋未纪/Leviticus)
ID 4  → prot_id: 4   (户籍纪/Numbers)
ID 5  → prot_id: 5   (申命纪/Deuteronomy)
ID 6  → prot_id: 6   (若苏厄记/Joshua)
ID 7  → prot_id: 7   (民长纪/Judges)
ID 8  → prot_id: 8   (卢德传/Ruth)
ID 9  → prot_id: 9   (撒慕尔纪上/1 Samuel)
ID 10 → prot_id: 10  (撒慕尔纪下/2 Samuel)
ID 11 → prot_id: 11  (列王纪上/1 Kings)
ID 12 → prot_id: 12  (列王纪下/2 Kings)
ID 13 → prot_id: 13  (编年纪上/1 Chronicles)
ID 14 → prot_id: 14  (编年纪下/2 Chronicles)
ID 15 → prot_id: 15  (厄斯德拉上/Ezra)
ID 16 → prot_id: 16  (乃赫米雅/Nehemiah)
ID 17 → prot_id: null (多俾亚传/Tobit — Deutero)
ID 18 → prot_id: null (友弟德传/Judith — Deutero)
ID 19 → prot_id: 17  (艾斯德尔传/Esther)
ID 20 → prot_id: null (玛加伯上/1 Maccabees — Deutero)
ID 21 → prot_id: null (玛加伯下/2 Maccabees — Deutero)
ID 22 → prot_id: 18  (约伯传/Job)
ID 23 → prot_id: 19  (圣咏集/Psalms)
ID 24 → prot_id: 20  (箴言/Proverbs)
ID 25 → prot_id: 21  (训道篇/Ecclesiastes)
ID 26 → prot_id: 22  (雅歌/Song of Songs)
ID 27 → prot_id: null (智慧篇/Wisdom — Deutero)
ID 28 → prot_id: null (德训篇/Sirach — Deutero)
ID 29 → prot_id: 23  (依撒意亚/Isaiah)
ID 30 → prot_id: 24  (耶肋米亚/Jeremiah)
ID 31 → prot_id: 25  (哀歌/Lamentations)
ID 32 → prot_id: null (巴路克/Baruch — Deutero)
ID 33 → prot_id: 26  (厄则克耳/Ezekiel)
ID 34 → prot_id: 27  (达尼尔/Daniel)
ID 35 → prot_id: 28  (欧瑟亚/Hosea)
ID 36 → prot_id: 29  (约厄尔/Joel)
ID 37 → prot_id: 30  (亚毛斯/Amos)
ID 38 → prot_id: 31  (亚北底亚/Obadiah)
ID 39 → prot_id: 32  (约纳/Jonah)
ID 40 → prot_id: 33  (米该亚/Micah)
ID 41 → prot_id: 34  (纳鸿/Nahum)
ID 42 → prot_id: 35  (哈巴谷/Habakkuk)
ID 43 → prot_id: 36  (索福尼亚/Zephaniah)
ID 44 → prot_id: 37  (哈盖/Haggai)
ID 45 → prot_id: 38  (匝加利亚/Zechariah)
ID 46 → prot_id: 39  (玛拉基/Malachi)
ID 47 → prot_id: 40  (玛窦/Matthew)
ID 48 → prot_id: 41  (马尔谷/Mark)
ID 49 → prot_id: 42  (路加/Luke)
ID 50 → prot_id: 43  (若望/John)
ID 51 → prot_id: 44  (宗徒大事录/Acts)
ID 52 → prot_id: 45  (罗马书/Romans)
ID 53 → prot_id: 46  (格林多前书/1 Corinthians)
ID 54 → prot_id: 47  (格林多后书/2 Corinthians)
ID 55 → prot_id: 48  (迦拉达书/Galatians)
ID 56 → prot_id: 49  (厄弗所书/Ephesians)
ID 57 → prot_id: 50  (斐理伯书/Philippians)
ID 58 → prot_id: 51  (哥罗森书/Colossians)
ID 59 → prot_id: 52  (得撒洛尼前书/1 Thessalonians)
ID 60 → prot_id: 53  (得撒洛尼后书/2 Thessalonians)
ID 61 → prot_id: 54  (弟茂德前书/1 Timothy)
ID 62 → prot_id: 55  (弟茂德后书/2 Timothy)
ID 63 → prot_id: 56  (弟铎书/Titus)
ID 64 → prot_id: 57  (费肋孟书/Philemon)
ID 65 → prot_id: 58  (希伯来书/Hebrews)
ID 66 → prot_id: 59  (雅各伯书/James)
ID 67 → prot_id: 60  (伯多禄前书/1 Peter)
ID 68 → prot_id: 61  (伯多禄后书/2 Peter)
ID 69 → prot_id: 62  (若望一书/1 John)
ID 70 → prot_id: 63  (若望二书/2 John)
ID 71 → prot_id: 64  (若望三书/3 John)
ID 72 → prot_id: 65  (犹达书/Jude)
ID 73 → prot_id: 66  (默示录/Revelation)
```

## 关键映射说明

- ID 19 (艾斯德尔传) → prot_id: 17（新教以斯帖记在第17位，因中间少了 17多俾亚传 和 18友弟德传）
- ID 34 (达尼尔) → prot_id: 27（新教达尼尔在第27位）
- ID 73 (默示录) → prot_id: 66（新教启示录在第66位）

## JSON 修改示例

每本书对象加一个字段，例如：

```json
{
  "id": 73,
  "prot_id": 66,
  "zh_cath": { "name": "默示录", "abbr": "默", "max_chapter": 22 },
  "zh_prot": { "name": "启示录", "abbr": "启", "max_chapter": 22 },
  "en": { "name": "Revelation", "abbr": "Rev", "max_chapter": 22 }
}
```

Deutero 书：

```json
{
  "id": 17,
  "prot_id": null,
  "zh_cath": { "name": "多俾亚传", "abbr": "多", "max_chapter": 14 },
  "zh_prot": null,
  "en": { "name": "Tobit", "abbr": "Tob", "max_chapter": 14 }
}
```
