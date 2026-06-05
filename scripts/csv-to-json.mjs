import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const CSV_PATH = join(root, 'départements.csv.txt')
const OUT_PATH = join(root, 'src', 'data', 'departements.json')

const REGIONS = {
  'Auvergne-Rhône-Alpes': ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'],
  'Bourgogne-Franche-Comté': ['21', '25', '39', '58', '70', '71', '89', '90'],
  'Bretagne': ['22', '29', '35', '56'],
  'Centre-Val de Loire': ['18', '28', '36', '37', '41', '45'],
  'Corse': ['2A', '2B'],
  'Grand Est': ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'],
  'Hauts-de-France': ['02', '59', '60', '62', '80'],
  'Île-de-France': ['75', '77', '78', '91', '92', '93', '94', '95'],
  'Normandie': ['14', '27', '50', '61', '76'],
  'Nouvelle-Aquitaine': ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'],
  'Occitanie': ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'],
  'Pays de la Loire': ['44', '49', '53', '72', '85'],
  "Provence-Alpes-Côte d'Azur": ['04', '05', '06', '13', '83', '84'],
  'Guadeloupe': ['971'],
  'Martinique': ['972'],
  'Guyane': ['973'],
  'La Réunion': ['974'],
  'Mayotte': ['976'],
}
const regionByCode = Object.fromEntries(
  Object.entries(REGIONS).flatMap(([region, codes]) => codes.map((c) => [c, region]))
)

const lines = readFileSync(CSV_PATH, 'utf8').trim().split(/\r?\n/).slice(1)

const departements = lines.map((line) => {
  const [code, nom, prefecture, sousPrefs] = line.split(';').map((s) => s.trim())
  const region = regionByCode[code]
  if (!region) throw new Error(`Région inconnue pour le code ${code}`)
  return {
    code,
    nom,
    prefecture,
    sousPrefectures: sousPrefs ? sousPrefs.split(',').map((s) => s.trim()).filter(Boolean) : [],
    region,
  }
})

if (departements.length !== 101) {
  throw new Error(`Attendu 101 départements, trouvé ${departements.length}`)
}

mkdirSync(dirname(OUT_PATH), { recursive: true })
writeFileSync(OUT_PATH, JSON.stringify(departements, null, 2) + '\n', 'utf8')
console.log(`✅ ${departements.length} départements écrits dans src/data/departements.json`)
