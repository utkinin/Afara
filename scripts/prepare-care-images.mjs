import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import sharp from 'sharp'

const dir = path.resolve('fixtures/care-education')
const [schoolInput, kindergartenInput] = process.argv.slice(2)
if (!schoolInput || !kindergartenInput) throw new Error('Pass the two original generated PNG paths: school and kindergarten')
await fs.mkdir(dir, { recursive: true })
const inputs = [
  { id: 'school-classroom', file: schoolInput, title: 'Школьный класс', alt: 'Школьный класс с партами, доской и матовыми портьерами у окон', resultId: 'exec-3f0e7b9f-729a-4e5b-b7aa-0c6fa12a6e78', prompt: 'Use case: photorealistic-natural. Asset type: AFARA educational-interiors website image, landscape 3:2. Create one original photorealistic architectural interior photograph-style concept of an unmistakable real modern SCHOOL CLASSROOM for ages 9–12 in Saint Petersburg, no people. Show orderly rows of realistically sized individual student desks and chairs facing a matte dark green classroom board with no legible writing, teacher desk, books and a small globe. Three large ordinary classroom windows along the side, ceiling about 3 metres, practical pale oak floor, ivory plaster walls, sensible rectangular acoustic ceiling lights. The textile subject must be clear: restrained matte taupe curtains with a narrow muted plum border on simple ceiling tracks at the windows, sheer warm-white layer, curtains neatly stacked so natural daylight reaches desks. Grounded everyday educational architecture, refined clean material quality but not a luxury lobby, no sofas, no stage, no hotel, no palace double-height glazing, no expensive chandeliers. Wide eye-level camera, straight believable perspective, realistic desk arrangement and fabric folds, windows and curtains visible near the centre for mobile cropping. Soft northern daylight. No text, no logos, no watermark, no claim of a real completed AFARA project.' },
  { id: 'kindergarten-group', file: kindergartenInput, title: 'Группа детского сада', alt: 'Группа детского сада с низкими столами, игрушками и двухцветными шторами у окон', resultId: 'exec-8113a377-9773-4213-bd36-8ab6bd963b25', prompt: 'Use case: photorealistic-natural. Asset type: AFARA website educational interiors gallery image, landscape 3:2. Create one original photorealistic architectural photograph-style concept of an unmistakable KINDERGARTEN GROUP PLAYROOM for preschool children aged 3–6, no people. A warm practical nursery classroom with child-height round wooden activity tables and small chairs, low open shelves of tidy wooden toys, children’s picture books, a restrained play rug and simple cubbies, with realistic scale and layout. Three ordinary large windows, ceiling about 3 metres. Curtains are the focal textile: simple matte muted plum and warm ivory colour-block side panels on ceiling tracks, layered with translucent ivory fabric, hem clearly above the floor and away from tables, no accessible dangling cords, no swags or loose ties. Palette pale oak, ivory, small muted sage and terracotta educational accents. Airy welcoming everyday preschool environment, not a residence, lounge, hotel or stage; no sofas or giant luxury windows. Eye-level wide architectural view with readable child-scale furniture and window arrangement, realistic material textures and fabric drape, soft natural daylight. No text, no logos, no watermark, no certification marks or implied actual AFARA project.' },
]
const images = []
for (const item of inputs) {
  const variants = {}
  for (const [name, width, height] of [['desktop', 1536, 1024], ['mobile', 768, 1024], ['thumb', 768, 512]]) {
    const file = `${item.id}-${name}.webp`
    const data = await sharp(item.file).resize(width, height, { fit: 'cover', position: 'centre' }).webp({ quality: name === 'desktop' ? 78 : 76, effort: 6 }).toBuffer()
    await fs.writeFile(path.join(dir, file), data)
    variants[name] = { file, width, height, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') }
  }
  images.push({ id: item.id, title: item.title, alt: item.alt, generation: { tool: 'image_gen.imagegen', date: '2026-10-18', resultId: item.resultId, prompt: item.prompt, mode: 'built-in' }, ...variants })
}
await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ version: 1, images }, null, 2) + '\n')
console.log(JSON.stringify(images.map(({ id, desktop, mobile, thumb }) => ({ id, desktop: desktop.bytes, mobile: mobile.bytes, thumb: thumb.bytes }))))
