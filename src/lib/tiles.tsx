import {
  Card,
  CardGrid,
  Heading,
  Icon,
  Stack,
  Text,
  useBreakpointDown,
  useBreakpointUp,
  type CanopIconName,
} from 'canopui'
import { Cascade, CascadeItem } from './motion.tsx'

const WIDE_TILE_WIDTH = '27rem'
const ROOMY_TILE_WIDTH = '22rem'
const COMPACT_TILE_WIDTH = '17rem'
const ROOMY_TILE_LIMIT = 4

function useMinTileWidth(count: number): string {
  const wide = useBreakpointUp('md')

  if (count > ROOMY_TILE_LIMIT) return COMPACT_TILE_WIDTH
  return wide ? WIDE_TILE_WIDTH : ROOMY_TILE_WIDTH
}

export interface TileModel<Id extends string> {
  id: Id
  icon: CanopIconName
  title: string
  desc: string
}

interface TileProps<Id extends string> {
  tile: TileModel<Id>
  roomy: boolean
  onPick: (id: Id) => void
}

function Tile<Id extends string>({ tile, roomy, onPick }: TileProps<Id>) {
  const narrow = useBreakpointDown('sm')
  const compact = narrow || !roomy

  return (
    <Card
      variant="interactive"
      radius="xl"
      density={compact ? 'auto' : 'comfortable'}
      fill
      ariaLabel={tile.title}
      onClick={() => onPick(tile.id)}
    >
      <Stack
        direction="row"
        gap={compact ? 'md' : 'lg'}
        alignItems="center"
        padding={compact ? 'none' : 'xs'}
        fill
      >
        <Icon name={tile.icon} variant="solid" size={compact ? 'lg' : 'xl'} color="primary" />
        <Stack gap="xs" alignItems="stretch" fill>
          {/*
            Un titre est un mot, et un mot ne se coupe pas : sa largeur est le
            plancher de la tuile, donc de la colonne. « Entrainement » en h4
            mesure 232 px en Titan One ; avec l'icone, la gouttiere et le
            rembourrage, la tuile ne pouvait pas descendre sous 352 px et
            debordait de sa colonne des que l'ecran passait sous 375 px --
            mesure a 320 et 360 px. En h5 avec l'icone d'un cran plus petite le
            plancher tombe a 278 px, sous la colonne la plus etroite qu'un
            telephone nous donne.
          */}
          <Heading level={3} size={compact ? 5 : 3} gutterBottom={false}>
            {tile.title}
          </Heading>
          <Text variant={compact ? 'body-sm' : 'body-md'} tone="muted">
            {tile.desc}
          </Text>
        </Stack>
      </Stack>
    </Card>
  )
}

interface TileGridProps<Id extends string> {
  tiles: readonly TileModel<Id>[]
  onPick: (id: Id) => void
}

export function TileGrid<Id extends string>({ tiles, onPick }: TileGridProps<Id>) {
  const minItemWidth = useMinTileWidth(tiles.length)
  const roomy = minItemWidth !== COMPACT_TILE_WIDTH

  return (
    <Cascade>
      <CardGrid minItemWidth={minItemWidth} gap="md">
        {tiles.map((tile) => (
          <CascadeItem key={tile.id} stretch>
            <Tile tile={tile} roomy={roomy} onPick={onPick} />
          </CascadeItem>
        ))}
      </CardGrid>
    </Cascade>
  )
}
