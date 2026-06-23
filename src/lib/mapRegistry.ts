import type maplibregl from "maplibre-gl";

const registry = new Map<string, maplibregl.Map>();

export const mapRegistry = {
  register:   (id: string, map: maplibregl.Map) => registry.set(id, map),
  unregister: (id: string)                       => registry.delete(id),
  get:        (id: string)                       => registry.get(id),
};
