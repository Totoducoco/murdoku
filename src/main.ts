import Phaser from "phaser";
import MenuScene from "./scenes/MenuScene";
import GameScene from "./scenes/GameScene";
import ResultScene from "./scenes/ResultScene";
import "./style.css";

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: "app",
    width: 1440,
    height: 960,
    backgroundColor: "#0b1020",
    scene: [MenuScene, GameScene, ResultScene],
    scale: {
        // Le canvas suit réellement la taille du navigateur.
        // Chaque scène choisit ensuite un layout desktop ou mobile.
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1440,
        height: 960
    },
    render: {
        antialias: true,
        roundPixels: true
    },
    input: {
        activePointers: 2
    }
};

new Phaser.Game(config);
