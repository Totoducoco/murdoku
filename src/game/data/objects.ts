import type { SceneObject } from "../model/types";

/**
 * Modèles d'objets utilisables sur les cases.
 * occupiable=true : un personnage peut se trouver sur cette case
 * (chaise, canapé, tapis...).
 * occupiable=false : l'objet bloque la case (table, armoire...).
 */
export type ObjectTemplate = Omit<SceneObject, "id" | "position">;

export const OCCUPIABLE_OBJECTS: readonly ObjectTemplate[] = [
    { name: "Chaise", type: "seat", occupiable: true },
    { name: "Canapé", type: "seat", occupiable: true },
    { name: "Fauteuil", type: "seat", occupiable: true },
    { name: "Lit", type: "furniture", occupiable: true },
    { name: "Tapis", type: "decoration", occupiable: true }
];

export const BLOCKING_OBJECTS: readonly ObjectTemplate[] = [
    { name: "Table", type: "furniture", occupiable: false },
    { name: "Étagère", type: "furniture", occupiable: false },
    { name: "Armoire", type: "furniture", occupiable: false },
    { name: "Télévision", type: "furniture", occupiable: false },
    { name: "Plante", type: "decoration", occupiable: false },
    { name: "Statue", type: "decoration", occupiable: false },
    { name: "Lampe", type: "decoration", occupiable: false },
    { name: "Piano", type: "furniture", occupiable: false }
];

export const ALL_OBJECTS: readonly ObjectTemplate[] = [
    ...OCCUPIABLE_OBJECTS,
    ...BLOCKING_OBJECTS
];
