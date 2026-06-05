declare module '@svg-maps/france.departments' {
  export interface MapLocation {
    id: string
    name: string
    path: string
  }

  export interface SvgMap {
    label?: string
    viewBox: string
    locations: MapLocation[]
  }

  const franceDepartments: SvgMap
  export default franceDepartments
}
