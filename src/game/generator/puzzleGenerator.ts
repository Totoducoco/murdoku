import type {
    Puzzle,
    PuzzleSolution
} from "../model/types";
import { generateBoard } from "./boardGenerator";
import { generateSolution } from "./solutionGenerator";
import { generateSceneObjects } from "./objectGenerator";
import { generateClues } from "./clueGenerator";
import { validateSolution } from "../solver/validator";
import { evaluateDifficulty, type DifficultyEvaluation } from "../solver/difficultyEvaluator";

export type PuzzleGenerationOptions = {
    size: number;
    roomCount?: number;
    seed?: number;
    suspectNames?: string[];
    victimName?: string;
    maxAttempts?: number;
};

export type CompleteGeneratedPuzzle = {
    puzzle: Puzzle;
    solution: PuzzleSolution;
    evaluation: DifficultyEvaluation;
};

/**
 * Pipeline complet : plateau -> personnages -> mobilier -> indices
 * -> contrôle de validité et d'unicité -> estimation de difficulté.
 */
export function generatePuzzle(
    options: PuzzleGenerationOptions
): CompleteGeneratedPuzzle {
    const maxAttempts = options.maxAttempts ?? 10;

    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
        throw new Error("maxAttempts doit être un entier positif.");
    }

    let lastError = "Aucune tentative effectuée.";

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const attemptSeed = options.seed === undefined
            ? undefined
            : options.seed + attempt * 17;

        try {
            const board = generateBoard({
                size: options.size,
                roomCount: options.roomCount,
                seed: attemptSeed
            });

            const generated = generateSolution(board, {
                suspectNames: options.suspectNames,
                victimName: options.victimName,
                seed: attemptSeed === undefined ? undefined : attemptSeed + 1
            });

            const boardWithObjects = generateSceneObjects(
                board,
                generated.people,
                generated.solution,
                { seed: attemptSeed === undefined ? undefined : attemptSeed + 2 }
            );

            const validation = validateSolution(
                boardWithObjects,
                generated.people,
                generated.solution
            );

            if (!validation.valid) {
                throw new Error(`Solution invalide : ${validation.errors.join(" ")}`);
            }

            const clues = generateClues(
                boardWithObjects,
                generated.people,
                generated.solution,
                { seed: attemptSeed === undefined ? undefined : attemptSeed + 3 }
            );

            const evaluation = evaluateDifficulty(
                boardWithObjects,
                generated.people,
                clues
            );

            if (!evaluation.valid || !evaluation.unique || evaluation.difficulty === null) {
                throw new Error("Les indices n'ont pas produit une solution unique.");
            }

            const caseId = attemptSeed ?? Math.floor(Math.random() * 1_000_000_000);
            const puzzle: Puzzle = {
                id: `case-${caseId}`,
                title: "Nouvelle affaire",
                difficulty: evaluation.difficulty,
                board: boardWithObjects,
                people: generated.people,
                clues
            };

            return {
                puzzle,
                solution: generated.solution,
                evaluation
            };
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
        }
    }

    throw new Error(
        `Impossible de générer une énigme valide après ${maxAttempts} tentatives. Dernière erreur : ${lastError}`
    );
}
