import type { Room } from "../model/types";

/** Modèles de pièces réutilisables par le générateur de plateau. */
export const ROOM_TEMPLATES: readonly Room[] = [
    { id: "kitchen", name: "Cuisine", color: "#E9B872" },
    { id: "living", name: "Salon", color: "#85BDA6" },
    { id: "bedroom", name: "Chambre", color: "#A7A6D9" },
    { id: "bathroom", name: "Salle de bain", color: "#86C5D8" },
    { id: "office", name: "Bureau", color: "#D69AAE" },
    { id: "dining", name: "Salle à manger", color: "#B5A1D8" },
    { id: "library", name: "Bibliothèque", color: "#A5B89B" },
    { id: "hall", name: "Hall", color: "#C6A78C" },
    { id: "garage", name: "Garage", color: "#9DAAB7" },
    { id: "garden", name: "Jardin", color: "#91B77D" },
    { id: "workshop", name: "Atelier", color: "#C59B78" },
    { id: "guest", name: "Chambre d'amis", color: "#B7A4C7" }
];
