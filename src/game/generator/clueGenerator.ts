import type {
    Board,
    Clue,
    ClueRule,
    Person,
    Position,
    PuzzleSolution
} from "../model/types";
import { solvePuzzle } from "../solver/solver";
import { validateSolution } from "../solver/validator";

export type ClueGenerationOptions = {
    seed?: number;
    /** Le solveur s'arrête après avoir trouvé ce nombre de solutions. */
    maxSolutions?: number;
    /** Nombre maximum d'indices "sur un objet" (très directs). Défaut : 1. */
    maxOnObjectClues?: number;
};

type ClueCandidate = {
    clue: Clue;
    weight: number;
};

const MIN_DISTINCT_RULE_TYPES = 3;
const DEFAULT_MAX_ON_OBJECT_CLUES = 1;

function createRandom(seed?: number): () => number {
    if (seed === undefined) return Math.random;

    let state = seed >>> 0;
    return () => {
        state += 0x6D2B79F5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffle<T>(values: T[], random: () => number): T[] {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index--) {
        const other = Math.floor(random() * (index + 1));
        [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
}

function getRoomId(board: Board, position: Position): string | undefined {
    return board.cells[position.row]?.[position.col]?.roomId;
}

/** « À côté » signifie une case orthogonalement voisine, même de l'autre côté d'une limite de pièce. */
function areAdjacent(a: Position, b: Position): boolean {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function getRelativeDirections(
    from: Position,
    to: Position
): Array<"north" | "south" | "east" | "west"> {
    const directions: Array<"north" | "south" | "east" | "west"> = [];

    if (to.row < from.row) directions.push("north");
    if (to.row > from.row) directions.push("south");
    if (to.col > from.col) directions.push("east");
    if (to.col < from.col) directions.push("west");

    return directions;
}

/** Article français simple pour les noms du catalogue d'objets. */
function withObjectArticle(name: string): string {
    const normalized = name.trim().toLocaleLowerCase("fr-FR");
    const feminine = new Set([
        "chaise", "table", "télévision", "étagère", "armoire",
        "plante", "statue", "lampe"
    ]);

    if (/^[aeiouyàâäéèêëîïôöùûü]/i.test(normalized)) {
        return `l'${normalized}`;
    }

    return `${feminine.has(normalized) ? "la" : "le"} ${normalized}`;
}

/** Forme complément après « à côté de » ou « près de ». */
function withDePhrase(phrase: string): string {
    if (phrase.startsWith("le ")) return `du ${phrase.slice(3)}`;
    if (phrase.startsWith("la ")) return `de la ${phrase.slice(3)}`;
    if (phrase.startsWith("l'")) return `de ${phrase}`;
    if (phrase.startsWith("les ")) return `des ${phrase.slice(4)}`;
    return `de ${phrase}`;
}

function withDeObjectArticle(name: string): string {
    return withDePhrase(withObjectArticle(name));
}

function normalizeObjectName(name: string): string {
    return name.trim().toLocaleLowerCase("fr-FR");
}

/**
 * Produit un libellé humainement identifiable sans révéler la pièce.
 * Si le nom de l'objet est en double, on le qualifie par un objet voisin
 * dont le nom est unique et qui permet d'identifier une seule copie.
 * Sans qualificatif fiable, l'objet ne pourra pas être utilisé dans un indice.
 */
function getObjectPhrase(
    board: Board,
    target: Board["objects"][number]
): string | null {
    const sameNameObjects = board.objects.filter(
        object => normalizeObjectName(object.name) === normalizeObjectName(target.name)
    );

    const basePhrase = withObjectArticle(target.name);
    if (sameNameObjects.length <= 1) return basePhrase;

    const uniqueAnchors = board.objects.filter(anchor => {
        if (anchor.id === target.id) return false;
        const sameAnchorNameCount = board.objects.filter(
            object => normalizeObjectName(object.name) === normalizeObjectName(anchor.name)
        ).length;
        return sameAnchorNameCount === 1 && areAdjacent(target.position, anchor.position);
    });

    for (const anchor of uniqueAnchors) {
        const matchingCopies = sameNameObjects.filter(copy =>
            areAdjacent(copy.position, anchor.position)
        );

        if (matchingCopies.length === 1 && matchingCopies[0].id === target.id) {
            return `${basePhrase} près ${withDeObjectArticle(anchor.name)}`;
        }
    }

    // Ne pas créer d'indice impossible à distinguer visuellement.
    return null;
}

function describeRule(
    board: Board,
    person: Person,
    rule: ClueRule,
    peopleById: Map<string, Person>,
    objectPhrases: Map<string, string | null>
): string {
    switch (rule.type) {
        case "in-room":
            return `${person.name} se trouvait dans une pièce précise.`;
        case "not-in-room":
            return `${person.name} ne se trouvait pas dans cette pièce.`;
        case "on-object": {
            const object = board.objects.find(item => item.id === rule.objectId);
            if (!object) return `${person.name} se trouvait sur un meuble.`;
            const phrase = objectPhrases.get(object.id) ?? withObjectArticle(object.name);
            return `${person.name} se trouvait sur ${phrase}.`;
        }
        case "beside-object": {
            const object = board.objects.find(item => item.id === rule.objectId);
            if (!object) return `${person.name} se trouvait juste à côté d'un objet.`;
            const phrase = objectPhrases.get(object.id) ?? withObjectArticle(object.name);
            return `${person.name} se trouvait juste à côté ${withDePhrase(phrase)}.`;
        }
        case "same-room-as":
            return `${person.name} se trouvait dans la même pièce que ${peopleById.get(rule.personId)?.name ?? rule.personId}.`;
        case "different-room-from":
            return `${person.name} ne se trouvait pas dans la même pièce que ${peopleById.get(rule.personId)?.name ?? rule.personId}.`;
        case "beside-person":
            return `${person.name} se trouvait à côté de ${peopleById.get(rule.personId)?.name ?? rule.personId}.`;
        case "relative-to-person": {
            const direction = {
                north: "au nord",
                south: "au sud",
                east: "à l'est",
                west: "à l'ouest"
            }[rule.direction];
            return `${person.name} se trouvait ${direction} de ${peopleById.get(rule.personId)?.name ?? rule.personId}.`;
        }
        case "on-row":
            return `${person.name} se trouvait sur la ligne ${rule.row + 1}.`;
        case "on-column":
            return `${person.name} se trouvait dans la colonne ${rule.col + 1}.`;
    }
}

function ruleKey(personId: string, rule: ClueRule): string {
    return `${personId}:${JSON.stringify(rule)}`;
}

function getRuleType(clue: Clue): string {
    return clue.rule.type;
}

function countCluesForPerson(clues: Clue[], personId: string): number {
    return clues.filter(clue => clue.personId === personId).length;
}

function isObjectClue(clue: Clue): boolean {
    return clue.rule.type === "beside-object" || clue.rule.type === "on-object";
}

function countObjectCluesForPerson(clues: Clue[], personId: string): number {
    return clues.filter(clue => clue.personId === personId && isObjectClue(clue)).length;
}

function countOnObjectClues(clues: Clue[]): number {
    return clues.filter(clue => clue.rule.type === "on-object").length;
}

function distinctRuleTypes(clues: Clue[]): Set<string> {
    return new Set(clues.map(getRuleType));
}

/**
 * Construit des indices vrais pour la solution secrète.
 * Les indices d'objet ne mentionnent volontairement jamais la pièce.
 * L'objectId interne distingue les objets portant le même nom.
 */
function buildCandidates(
    board: Board,
    people: Person[],
    solution: PuzzleSolution
): ClueCandidate[] {
    const candidates: ClueCandidate[] = [];
    const peopleById = new Map(people.map(person => [person.id, person]));
    const suspects = people.filter(person => person.role === "suspect");
    const objectPhrases = new Map<string, string | null>(
        board.objects.map(object => [object.id, getObjectPhrase(board, object)] as const)
    );

    const add = (person: Person, rule: ClueRule, weight: number): void => {
        const clue: Clue = {
            id: `clue-${person.id}-${candidates.length + 1}`,
            personId: person.id,
            description: describeRule(board, person, rule, peopleById, objectPhrases),
            rule
        };
        candidates.push({ clue, weight });
    };

    for (const person of suspects) {
        const position = solution.positions[person.id];
        if (!position) throw new Error(`Position manquante pour ${person.name}.`);

        // Les objets sont explorés en priorité. Chaque objet est ciblé par son
        // objectId : plusieurs « Tables » peuvent donc coexister comme leurres.
        for (const object of board.objects) {
            // Une copie d'objet doit être identifiable dans le texte.
            // Les doublons restent sur le plateau, mais un indice ne cible
            // une copie que si un objet voisin unique permet de la distinguer.
            if (!objectPhrases.get(object.id)) continue;

            const samePosition =
                object.position.row === position.row &&
                object.position.col === position.col;

            if (samePosition && object.occupiable) {
                // Un indice d'occupation exacte reste rare, car il est très révélateur.
                add(person, { type: "on-object", objectId: object.id }, 2.8);
            } else if (areAdjacent(position, object.position)) {
                // Les indices de proximité deviennent la principale source d'indices mobilier.
                add(person, { type: "beside-object", objectId: object.id }, 0.15);
            }
        }

        // Relations uniquement avec les autres suspects.
        // La victime ne doit jamais être mentionnée dans un indice : sa position
        // doit être déduite par élimination une fois les suspects placés.
        for (const other of suspects) {
            if (other.id === person.id) continue;

            const otherPosition = solution.positions[other.id];
            if (!otherPosition) continue;

            const sameRoom =
                getRoomId(board, position) === getRoomId(board, otherPosition);

            add(
                person,
                {
                    type: sameRoom ? "same-room-as" : "different-room-from",
                    personId: other.id
                },
                1.7
            );

            if (areAdjacent(position, otherPosition)) {
                add(person, { type: "beside-person", personId: other.id }, 1.9);
            }

            for (const direction of getRelativeDirections(otherPosition, position)) {
                add(
                    person,
                    { type: "relative-to-person", personId: other.id, direction },
                    1.15
                );
            }
        }
    }

    // Déduplique les règles identiques, mais deux objets de même nom restent
    // des cibles différentes puisque leurs objectId sont différents.
    const unique = new Map<string, ClueCandidate>();
    for (const candidate of candidates) {
        const key = ruleKey(candidate.clue.personId, candidate.clue.rule);
        if (!unique.has(key)) unique.set(key, candidate);
    }

    return [...unique.values()];
}

function hasUniqueSolution(
    board: Board,
    people: Person[],
    clues: Clue[],
    maxSolutions: number
): boolean {
    const result = solvePuzzle(board, people, clues, { maxSolutions });
    return result.solutions.length === 1 && !result.limitReached;
}

function chooseBest(
    candidates: ClueCandidate[],
    selected: Clue[],
    random: () => number
): ClueCandidate | undefined {
    const usedTypes = distinctRuleTypes(selected);

    return shuffle(candidates, random)
        .map(candidate => {
            const type = getRuleType(candidate.clue);
            const alreadyUsed = usedTypes.has(type);
            const personCount = countCluesForPerson(selected, candidate.clue.personId);
            const score = candidate.weight +
                (alreadyUsed ? 0.25 : 0) +
                personCount * 0.2 +
                random() * 0.15;
            return { candidate, score };
        })
        .sort((a, b) => a.score - b.score)[0]?.candidate;
}

function canUseCandidate(
    candidate: ClueCandidate,
    selected: Clue[],
    maxOnObjectClues: number
): boolean {
    const type = candidate.clue.rule.type;

    if (type === "on-row" || type === "on-column") return false;
    if (type === "on-object" && countOnObjectClues(selected) >= maxOnObjectClues) {
        return false;
    }

    const candidateKey = ruleKey(candidate.clue.personId, candidate.clue.rule);
    return !selected.some(clue =>
        clue.id === candidate.clue.id ||
        ruleKey(clue.personId, clue.rule) === candidateKey
    );
}

/**
 * Sélectionne au moins un indice par suspect.
 * Si un suspect possède un indice de proximité avec un objet,
 * celui-ci est choisi en priorité. « Sur un objet » reste limité.
 */
function chooseCoverageClues(
    suspects: Person[],
    candidates: ClueCandidate[],
    random: () => number,
    maxOnObjectClues: number
): Clue[] {
    const selected: Clue[] = [];

    for (const suspect of shuffle(suspects, random)) {
        const own = candidates.filter(candidate => candidate.clue.personId === suspect.id);
        const besideObject = own.filter(candidate => candidate.clue.rule.type === "beside-object");
        const onObject = own.filter(candidate => candidate.clue.rule.type === "on-object");

        // Une proximité avec un objet est préférée aux autres formulations.
        let chosen = chooseBest(besideObject, selected, random);

        // Si aucun objet n'est adjacent, on peut garder exceptionnellement
        // un indice exact « sur un objet », dans la limite globale configurée.
        if (!chosen && countOnObjectClues(selected) < maxOnObjectClues) {
            if (onObject.length > 0 && random() < 0.35) {
                chosen = chooseBest(onObject, selected, random);
            }
        }

        // Sinon, on prend une relation avec un autre personnage.
        if (!chosen) {
            const relational = own.filter(candidate =>
                candidate.clue.rule.type !== "on-object" &&
                candidate.clue.rule.type !== "beside-object" &&
                candidate.clue.rule.type !== "on-row" &&
                candidate.clue.rule.type !== "on-column"
            );
            chosen = chooseBest(relational, selected, random);
        }

        // Dernier recours : n'importe quel indice vrai autorisé.
        if (!chosen && countOnObjectClues(selected) < maxOnObjectClues) {
            chosen = chooseBest(onObject, selected, random);
        }

        if (!chosen) {
            throw new Error(`Aucun indice disponible pour ${suspect.name}.`);
        }

        selected.push(chosen.clue);
    }

    return selected;
}

/**
 * Génère une sélection courte, variée et résoluble :
 * - au moins un indice par suspect ;
 * - beaucoup plus d'indices liés aux objets ;
 * - aucun indice donnant une ligne ou une colonne ;
 * - aucun nom de pièce dans les indices d'objet ;
 * - « sur un objet » reste rare ;
 * - les identifiants d'objet sont utilisés en interne pour distinguer les doublons ;
 * - aucun indice ne mentionne la victime ni ne l'utilise comme référence.
 */
export function generateClues(
    board: Board,
    people: Person[],
    solution: PuzzleSolution,
    options: ClueGenerationOptions = {}
): Clue[] {
    const random = createRandom(options.seed);
    const maxSolutions = options.maxSolutions ?? 2;
    const maxOnObjectClues = options.maxOnObjectClues ?? DEFAULT_MAX_ON_OBJECT_CLUES;

    if (!Number.isInteger(maxSolutions) || maxSolutions < 2) {
        throw new Error("maxSolutions doit être un entier supérieur ou égal à 2 pour vérifier l'unicité.");
    }
    if (!Number.isInteger(maxOnObjectClues) || maxOnObjectClues < 0) {
        throw new Error("maxOnObjectClues doit être un entier positif ou nul.");
    }

    const validation = validateSolution(board, people, solution);
    if (!validation.valid) {
        throw new Error(`Impossible de générer des indices : ${validation.errors.join(" ")}`);
    }

    const suspects = people.filter(person => person.role === "suspect");
    const victim = people.find(person => person.role === "victim");
    if (!victim) {
        throw new Error("Victime manquante dans la liste des personnages.");
    }
    if (suspects.length === 0) {
        throw new Error("Aucun suspect disponible pour générer les indices.");
    }

    // Barrière de sécurité : aucun indice ne peut concerner la victime,
    // ni la prendre comme personnage de référence.
    const referencesVictim = (clue: Clue): boolean =>
        clue.personId === victim.id ||
        ("personId" in clue.rule && clue.rule.personId === victim.id);

    const candidates = shuffle(
        buildCandidates(board, people, solution).filter(candidate =>
            candidate.clue.rule.type !== "on-row" &&
            candidate.clue.rule.type !== "on-column" &&
            !referencesVictim(candidate.clue)
        ),
        random
    );

    // 1. Couverture : un indice au minimum pour chaque suspect.
    const selected = chooseCoverageClues(
        suspects,
        candidates,
        random,
        maxOnObjectClues
    );

    // 2. Ajouter le moins d'indices possible jusqu'à obtenir une solution unique.
    // Les indices d'objet sont classés en priorité (poids plus faible).
    let safetyCounter = 0;
    const maxAdditionalClues = suspects.length * 8 + board.objects.length * 2 + 20;

    while (!hasUniqueSolution(board, people, selected, maxSolutions)) {
        if (safetyCounter++ >= maxAdditionalClues) {
            throw new Error(
                "La génération a dépassé le nombre maximal d'indices. " +
                "Un autre plateau ou une autre disposition doit être essayé."
            );
        }

        const eligible = candidates.filter(candidate =>
            canUseCandidate(candidate, selected, maxOnObjectClues)
        );

        if (eligible.length === 0) {
            throw new Error(
                "Impossible d'obtenir une solution unique avec les indices disponibles. " +
                "Le générateur doit réessayer avec un autre plateau ou une autre disposition."
            );
        }

        const next = chooseBest(eligible, selected, random);
        if (!next) throw new Error("Aucun indice supplémentaire sélectionnable.");
        selected.push(next.clue);
    }

    // Suspects ayant au moins une possibilité d'indice fondé sur un objet.
    // On conserve un indice objet pour chacun d'eux : les objets restent donc
    // une mécanique centrale même après la suppression des indices superflus.
    const objectEligibleSuspects = new Set(
        candidates
            // On conserve obligatoirement les indices de proximité, plus
            // naturels et moins directs. Les indices « sur un objet » restent
            // facultatifs et rares.
            .filter(candidate => candidate.clue.rule.type === "beside-object")
            .map(candidate => candidate.clue.personId)
    );

    // 3. Réduction itérative : chaque retrait est retesté par le solveur.
    // On conserve toujours un indice par suspect et un indice objet pour
    // chaque suspect qui pouvait en recevoir un.
    const minDistinctTypes = Math.min(
        MIN_DISTINCT_RULE_TYPES,
        distinctRuleTypes(candidates.map(candidate => candidate.clue)).size
    );

    let changed = true;
    while (changed) {
        changed = false;

        for (const clueToTest of shuffle([...selected], random)) {
            const index = selected.findIndex(clue => clue.id === clueToTest.id);
            if (index === -1) continue;

            if (countCluesForPerson(selected, clueToTest.personId) <= 1) continue;

            if (
                isObjectClue(clueToTest) &&
                objectEligibleSuspects.has(clueToTest.personId) &&
                countObjectCluesForPerson(selected, clueToTest.personId) <= 1
            ) {
                continue;
            }

            const type = getRuleType(clueToTest);
            const sameTypeCount = selected.filter(clue => getRuleType(clue) === type).length;
            if (sameTypeCount <= 1 && distinctRuleTypes(selected).size <= minDistinctTypes) {
                continue;
            }

            const trial = selected.filter((_, clueIndex) => clueIndex !== index);
            if (hasUniqueSolution(board, people, trial, maxSolutions)) {
                selected.splice(index, 1);
                changed = true;
            }
        }
    }

    // 4. Contrôles finaux.
    const missingSuspect = suspects.find(
        suspect => countCluesForPerson(selected, suspect.id) === 0
    );
    if (missingSuspect) {
        throw new Error(`Aucun indice ne concerne ${missingSuspect.name}.`);
    }

    if (selected.some(clue =>
        clue.rule.type === "on-row" || clue.rule.type === "on-column"
    )) {
        throw new Error("Un indice de ligne ou de colonne interdit a été généré.");
    }

    if (selected.some(referencesVictim)) {
        throw new Error("Un indice mentionnant la victime a été généré, ce qui est interdit.");
    }

    for (const suspectId of objectEligibleSuspects) {
        if (countObjectCluesForPerson(selected, suspectId) === 0) {
            throw new Error(`L'indice objet de ${suspectId} a été supprimé par erreur.`);
        }
    }

    if (!hasUniqueSolution(board, people, selected, maxSolutions)) {
        throw new Error("La réduction des indices a rendu l'affaire ambiguë.");
    }

    // Affichage ordonné par personnage, en conservant l'ordre des suspects
    // reçu par le générateur. Les indices d'un même suspect restent groupés.
    const peopleOrder = new Map(people.map((person, index) => [person.id, index]));
    return selected.sort((a, b) =>
        (peopleOrder.get(a.personId) ?? Number.MAX_SAFE_INTEGER) -
        (peopleOrder.get(b.personId) ?? Number.MAX_SAFE_INTEGER)
    );
}
