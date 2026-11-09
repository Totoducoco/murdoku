# Murdoku — rendu net et responsive

Ce correctif remplace les scènes d'interface et la configuration Phaser pour éviter la mise à l'échelle fractionnaire des conteneurs, qui rend le texte flou.

## Fichiers à remplacer

- `index.html` → racine du projet
- `src/main.ts`
- `src/style.css`
- `src/scenes/MenuScene.ts`
- `src/scenes/GameScene.ts`
- `src/scenes/ResultScene.ts`

Ne remplace pas `src/game/` : le générateur, les objets, les identifiants, les indices et le solveur restent inchangés.

## Principes appliqués

- Canvas Phaser en mode `RESIZE` : la surface du jeu suit la taille réelle du conteneur.
- Aucune règle CSS `width: 100% !important` / `height: 100% !important` sur le canvas.
- Aucun `Container.setScale()` pour adapter les écrans : les scènes utilisent des coordonnées réelles et des mises en page dédiées.
- Menu : 4 cartes sur grand écran, grille 2×2 sur tablette, cartes horizontales sur téléphone.
- Jeu : interface desktop uniquement à partir de 1440×960 ; en dessous, interface à onglets redessinée à la taille réelle du viewport.
- Résultat : centré sans mise à l'échelle fractionnaire.

## Installation

Copier les fichiers en conservant l'arborescence, puis lancer :

```bash
npm run build
npm run dev
```

Tester le menu et une partie à ces tailles approximatives : 390×844, 768×1024, 1024×768, 1366×768 et 1920×1080.
