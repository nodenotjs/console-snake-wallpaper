'use strict';

const DIRECTION = {
    UP: 1,
    LEFT: 2,
    DOWN: 3,
    RIGHT: 4,

    getOppositeDirection(direction) {
        switch (direction) {
            case DIRECTION.UP:
                return DIRECTION.DOWN;
            case DIRECTION.DOWN:
                return DIRECTION.UP;
            case DIRECTION.LEFT:
                return DIRECTION.RIGHT;
            case DIRECTION.RIGHT:
                return DIRECTION.LEFT;
            default:
                console.error(`getOppositeDirection received invalid direction ${direction}`)
                return DIRECTION.UP;
        }
    }
}

const GAMESTATE = {
    INITALIZING: 1,
    PLAYING: 2,
    DYING: 3,
    DEAD: 4,
    POST_DEAD: 5,
}

const TEXT_ANCHOR = {
    TOP_LEFT: 0,
    BOTTOM_LEFT: 1,
    TOP_RIGHT: 2,
    BOTTOM_RIGHT: 3,
}

const SNAKE_SKIN = {
    SOLID: 0,
    RAINBOW: 1,
}

const GAME_EFFECTS = {
    INVINCIBILITY: 1,
    NOT_GROWING: 2,
    REJUVENATION: 3,
    SHRINKING2: 4,
}

const FOOD_TYPE = {
    COMMON: 1,
    GOLDEN: 2,
    RAINBOW: 3,
    UMAMI: 4,
    REJUVENATION: 5,
    DANGER: 6,
}

class Game {
    /** @type {Vector2} */
    arenaSize;

    /** @type {Snake} */
    snake;
    /** @type {number} */
    initalSnakeSize;
    /** @type {number} */
    snakeSkin;
    /** @type {boolean} */
    wallWarps;

    /** @type {Food[]} */
    foods;
    /** @type {number} */
    foodMaxAmmount;
    /** @type {boolean} */
    initFoodOnInit;

    /** @type {number} */
    state;
    /** @type {number} */
    score;

    /** @type {number} */
    bestScore;
    /** @type {number} */
    largestSnakeSize;

    /** @type {number} */
    tickCount;
    /** @type {number} */
    ticksToNextRandomInput;
    /** @type {number} */
    deathCount;

    /** @type {Map<Number, Number>} */
    effects;

    /** @type {number} */
    gameTickInterval;
    /** @type {number} */
    deathInterval;
    /** @type {number} */
    tickTimeout;

    /** @type {number} */
    currentDirection;
    /** @type {boolean} */
    _usingUserInput;
    /** @type {number} */
    _userInputDirection;
    /** @type {number[]} */
    _userInputBuffer


    /**
     * @param {object} settings 
     */
    constructor(settings) {
        this.currentDirection = null;
        this.arenaSize = settings.arenaSize;
        this.snake = null;
        this.foodMaxAmmount = settings.maxFood;
        this.foods = [];
        this.dangerFoods = [];
        this.state = GAMESTATE.INITALIZING;
        this.score = 0;
        this.bestScore = 0;
        this.largestSnakeSize = 0;
        this.tickCount = 0;
        this.ticksToNextRandomInput = 0;
        this.deathCount = 0;
        this.effects = new Map();
        this.initFoodOnInit = settings.initFoodOnInit;
        this.wallWarps = settings.wallWarp;
        this.gameTickInterval = settings.gameTickInterval;
        this.deathInterval = settings.deathInterval;
        this._usingUserInput = settings.playerController;
        this._userInputDirection = DIRECTION.UP;
        this.initalSnakeSize = settings.initalSnakeSize;
        this.snakeSkin = settings.snakeSkin;
        this.texts = settings.texts;
        this._userInputBuffer = [];

        this.texts = {
            textBoxTopLeft: settings.textBoxTopLeft,
            textBoxTopRight: settings.textBoxTopRight,
            textBoxBottomLeft: settings.textBoxBottomLeft,
            textBoxBottomRight: settings.textBoxBottomRight,
        }
    }

    /**
     * @param {number} direction 
    */
    handleUserInput(direction) {
        if (this._shouldAddUserInputToBuffer(direction) === false) return;
        if (this._shouldClearUserInputBuffer()) {
            this._userInputBuffer.length = 0;
        }
        this._userInputBuffer.push({ direction: direction, timestamp: performance.now() });
    }

    /**
    * @param {boolean} value 
    */
    setUsingUserInput(value) {
        if (this._usingUserInput == false && value == true) {
            this._userInputBuffer.length = 0;
            this._userInputDirection = this.currentDirection;
        }
        this._usingUserInput = value;
    }

    /**
    * @param {boolean} value 
    */
    getUsingUserInput() {
        return this._usingUserInput;
    }

    /**
    * @param {boolean} value 
    */
    getLastUserInput() {
        return this._userInputBuffer.length > 0 ? this._userInputBuffer[this._userInputBuffer.length - 1].direction : this._userInputDirection
    }



    /**
     * @returns {boolean}
     */
    _shouldAddUserInputToBuffer(direction) {
        if (this._userInputBuffer.length > 0) {
            let lastInputDirection = this._userInputBuffer[this._userInputBuffer.length - 1].direction
            return lastInputDirection !== direction;
        }

        return true;
    }

    /**
     * @returns {boolean}
     */
    _shouldClearUserInputBuffer() {

        // const foolProofInterval = 300;
        const foolProofInterval = this.gameTickInterval;

        if (this._userInputBuffer.length > 0) {
            let lastInput = this._userInputBuffer[this._userInputBuffer.length - 1]
            let lastInputTimeDiffernece = performance.now() - lastInput.timestamp;

            if (lastInputTimeDiffernece >= foolProofInterval) {
                return true
            }
        }

        return false;
    }

    startTicking() {
        this.tick();
    }

    // ------------------------ tick --------------------------
    tick() {
        switch (this.state) {
            case GAMESTATE.INITALIZING:
                this._initGameState();
                break;
            case GAMESTATE.PLAYING:
                this._playGameState();
                break;
            case GAMESTATE.DYING:
                this._dyingGameState();
                break;
            case GAMESTATE.DEAD:
                this._deadGameState();
                break;
            case GAMESTATE.POST_DEAD:
                this._postDeadGameState();
                break;
        }
        this.tickCount += 1;
    }

    _initGameState() {
        this.currentDirection = this.arenaSize.x > this.arenaSize.y ? DIRECTION.LEFT : DIRECTION.UP;
        this.snake = new Snake(this.arenaSize.divFloor(new Vector2(2, 2)));
        this.snake.increaseBody(this.initalSnakeSize - 1);
        this.score = 0;
        this.foods = []
        this.state = GAMESTATE.PLAYING;

        this.ticksToNextRandomInput = 0;

        if (this.initFoodOnInit == true)
            this._initFoods();

        this.effects.clear();

        this._userInputBuffer.length = 0;

        this._clearNextTickTimeout();
        this._setNextTickTimeout(setTimeout(() => this.tick(), 0));
    }

    _initFoods() {
        let errors = 0;
        const MAX_ERRORS = 30;
        while (this.foodMaxAmmount > this.foods.length && errors < MAX_ERRORS) {
            let success = this._trySpawnFoodInRandomLocation((randomPos) => this._createRandomFood(randomPos));
            if (success == false) errors += 1;
        }
        if (errors >= MAX_ERRORS) console.warn("Failed to init with all foods");
    }

    _playGameState() {
        // Decide random input
        this.currentDirection = this._decideDirection();

        this._snakeMovement();

        let foodLimit = Math.min(this.foodMaxAmmount, (this.arenaSize.x * this.arenaSize.y) - this.foods.length - this.snake.length())
        if (foodLimit > this.foods.length) {
            this._trySpawnFoodInRandomLocation((randomPos) => this._createRandomFood(randomPos));
        }

        // CHECK DEATH
        let isDead = this._checkIsDead();

        if (isDead == false) {
            // Check Collision with Food and remove it if collided
            this._processFoodCollision();

            this._setNextTickTimeout(setTimeout(() => this.tick(), this.gameTickInterval));
        }
        else {
            this.state = GAMESTATE.DYING;
            this._clearNextTickTimeout();
            this._setNextTickTimeout(setTimeout(() => this.tick(), 0));
        }

        this._tickEffects();
    }

    /**
    * @returns {number}
    */
    _decideDirection() {
        if (this.getUsingUserInput() === true) {
            this._processUserInputBuffer();
            return this.getUserInputDirection();
        } else {
            return this._calculateRandomWalkingDirection();
        }
    }

    _processUserInputBuffer() {
        if (this._userInputBuffer.length > 0) {
            let direction = this._userInputBuffer[0].direction;

            // if (!this._isValidInput(direction)) {
            //     this._userInputBuffer.length = 0;
            //     return;
            // }

            this._userInputDirection = this._userInputBuffer[0].direction;
            this._userInputBuffer = this._userInputBuffer.slice(1);
        }


    }

    /**
     * @returns {number}
     */
    getUserInputDirection() {
        if (this._isValidInput(this._userInputDirection))
            return this._userInputDirection
        else
            return this.currentDirection;
    }

    /**
     * @returns {number}
     */
    _calculateRandomWalkingDirection() {
        if (this.ticksToNextRandomInput <= 0) {
            const possibleDirections = this._calculatePossibleRandomDirections();
            let direction;
            if (possibleDirections.length > 0)
                direction = possibleDirections[Math.floor(Math.random() * possibleDirections.length)]
            else {
                console.warn("_calculateRandomWalkingDirection cannot move anywhere");
                return this.currentDirection;
            }

            if (this.wallWarps == true) {
                let maxDistanceToWalkWithWallWarp;
                switch (direction) {
                    case DIRECTION.UP:
                    case DIRECTION.DOWN:
                        maxDistanceToWalkWithWallWarp = this.arenaSize.y
                        break;
                    case DIRECTION.LEFT:
                    case DIRECTION.RIGHT:
                        maxDistanceToWalkWithWallWarp = this.arenaSize.x
                        break;
                    default:
                        console.error("_calculateRandomInputDirection calculated a invalid direction")
                        break;
                }

                this.ticksToNextRandomInput = Math.floor(Math.random() * maxDistanceToWalkWithWallWarp); // maybe add +1 so it can collide withself when warp
            } else {
                let headPosition = this.snake.getHead();
                let maxDistanceToWalkToNoCollide;

                switch (direction) {
                    case DIRECTION.UP:
                        maxDistanceToWalkToNoCollide = headPosition.y - 1;
                        break;
                    case DIRECTION.DOWN:
                        maxDistanceToWalkToNoCollide = this.arenaSize.y - headPosition.y - 2;
                        break;
                    case DIRECTION.LEFT:
                        maxDistanceToWalkToNoCollide = headPosition.x - 1;
                        break;
                    case DIRECTION.RIGHT:
                        maxDistanceToWalkToNoCollide = this.arenaSize.x - headPosition.x - 2;
                        break;
                    default:
                        console.error("_calculateRandomInputDirection calculated a invalid direction")
                        break;

                }
                this.ticksToNextRandomInput = Math.floor(Math.min(Math.random() * maxDistanceToWalkToNoCollide * 1.25, maxDistanceToWalkToNoCollide));
            }

            return direction;
        } else {
            this.ticksToNextRandomInput -= 1;
        }

        return this.currentDirection;
    }

    _shouldMoveToThisDirection(direction) {
        let isValidInput = this._isValidInput(direction);
        let isDifferentFromCurrent = direction != this.currentDirection;

        let willGoOutOfBoundaries = this._isPositionOutOfArena(this.snake.getHead().sum(directionToVector(direction)))

        if (this.wallWarps)
            return isValidInput && isDifferentFromCurrent;
        else
            return isValidInput && !willGoOutOfBoundaries;
    }

    /**
     * @returns {number[]}
     */
    _calculatePossibleRandomDirections() {
        let possibleDirections = [];
        if (this._shouldMoveToThisDirection(DIRECTION.UP)) possibleDirections.push(DIRECTION.UP)
        if (this._shouldMoveToThisDirection(DIRECTION.DOWN)) possibleDirections.push(DIRECTION.DOWN)
        if (this._shouldMoveToThisDirection(DIRECTION.LEFT)) possibleDirections.push(DIRECTION.LEFT)
        if (this._shouldMoveToThisDirection(DIRECTION.RIGHT)) possibleDirections.push(DIRECTION.RIGHT)
        return possibleDirections;
    }

    _snakeMovement() {
        this.snake.moveHead(directionToVector(this.currentDirection));

        let mustWarpHead = this.wallWarps == true && !(this.hasEffect(GAME_EFFECTS.INVINCIBILITY) && this.getUsingUserInput());
        if (mustWarpHead) {
            this.snake.warpHead(this.arenaSize);
        }
    }

    /**
     * @returns {boolean}
     */
    _checkIsDead() {
        // Check self collision
        let dangerFoods = this.foods.filter(f => f.type == FOOD_TYPE.DANGER).map(f => f.position);
        let toCheck = [...this.snake.getBodyOnly(), ...dangerFoods];
        if (this.snake.getTail() != null) toCheck.push(this.snake.getTail());

        let isCollidingWithLethalPosition = this._isCollidingCount(toCheck, this.snake.getHead());

        let snakeHeadPosition = this.snake.getHead();
        let isCollidingWithWall = this._isPositionOutOfArena(snakeHeadPosition);
        return !this.hasEffect(GAME_EFFECTS.INVINCIBILITY) && (isCollidingWithLethalPosition || isCollidingWithWall);
    }

    _tickEffects() {
        if (this.hasEffect(GAME_EFFECTS.SHRINKING2) == true) {
            this.snake.decreaseBody(1);

        }
        if (this.hasEffect(GAME_EFFECTS.SHRINKING2) == true || this.hasEffect(GAME_EFFECTS.REJUVENATION) == true) {
            if (this.snake.length() <= 1) {
                this.setEffectDuration(GAME_EFFECTS.REJUVENATION, 0);
                this.setEffectDuration(GAME_EFFECTS.SHRINKING2, 0);
            }
        }

        this.effects.forEach((value, effect) => {
            if (this.getEffectDuration(effect) >= 0)
                this.setEffectDuration(effect, value - 1);
        })
    }

    /**
     * @param {Vector2} pos 
     */
    _isPositionOutOfArena(pos) {
        return pos.x < 0 || pos.y < 0 || pos.x >= this.arenaSize.x || pos.y >= this.arenaSize.y;
    }

    _processFoodCollision() {
        let foodCollisions = this._isCollidingIndexes(this.foods.map(f => f.position), this.snake.getHead());
        if (foodCollisions.length > 0) {
            for (let i = 0; i < foodCollisions.length; i++) {
                let foodIndex = foodCollisions[i];
                const food = this.foods[foodIndex];
                this._snakeEatFood(food);
                this.foods[foodIndex] = null;
            }
            this.foods = this.foods.filter(f => f != null);
        }
    }

    /**
     * @param {Food} food 
     */
    _snakeEatFood(food) {
        const umamiFoodNotGrowingTicksDuration = 300;
        const rainbowFoodInvicibilityTicksDuration = 100;
        const rejuvenationFoodNotGrowingTicksDuration = 150;


        if (food.type == FOOD_TYPE.RAINBOW)
            this.applyEffect(GAME_EFFECTS.INVINCIBILITY, rainbowFoodInvicibilityTicksDuration);
        if (food.type == FOOD_TYPE.UMAMI)
            this.applyEffect(GAME_EFFECTS.NOT_GROWING, umamiFoodNotGrowingTicksDuration);
        if (food.type == FOOD_TYPE.REJUVENATION)
            this.applyEffect(GAME_EFFECTS.REJUVENATION, rejuvenationFoodNotGrowingTicksDuration);

        let increaseSize = food.increaseSize;

        this.score += food.score;
        if (this.hasEffect(GAME_EFFECTS.REJUVENATION)) {
            this.applyEffect(GAME_EFFECTS.SHRINKING2, Math.abs(increaseSize) * 2);
        }
        if (this.hasEffect(GAME_EFFECTS.NOT_GROWING)) increaseSize *= 0
        this.snake.increaseBody(increaseSize);
    }

    _dyingGameState() {
        this.state = GAMESTATE.DEAD;

        this._clearNextTickTimeout();
        this._setNextTickTimeout(setTimeout(() => this.tick(), 0));
    }

    _deadGameState() {
        this._setNextTickTimeout(setTimeout(() => {
            this.state = GAMESTATE.POST_DEAD;
            this.startTicking();
        }, this.deathInterval));
    }

    _postDeadGameState() {
        this.state = GAMESTATE.INITALIZING;
        this.bestScore = Math.max(this.score, this.bestScore);
        this.largestSnakeSize = Math.max(this.snake.length(), this.largestSnakeSize);
        this.deathCount += 1;


        this._setNextTickTimeout(setTimeout(() => this.tick(), 0));
    }

    _setNextTickTimeout(number) {
        this._clearNextTickTimeout();
        this.tickTimeout = number;
    }

    _clearNextTickTimeout() {
        clearTimeout(this.tickTimeout);
    }

    clearNextTickTimeout() {
        this._clearNextTickTimeout();
    }

    /**
     * @param {Food} food
     * @returns {boolean}
     */
    _trySpawnFoodInRandomLocation(foodFactory) {
        let tryCount = 0;
        let success = false;

        let score;

        do {
            let randomX = Math.floor(this.arenaSize.x * Math.random());
            let randomY = Math.floor(this.arenaSize.y * Math.random());
            let randomVec = new Vector2(randomX, randomY);

            let objectsToCheck = [...this.snake.getEntireBody(), ...this.foods.map(f => f.position)];

            if (this._isCollidingCount(objectsToCheck, randomVec) == 0) {
                let food = foodFactory(randomVec);
                this.foods.push(food);
                success = true;
            }
            tryCount += 1;
        } while (tryCount < 100 && !success);

        if (!success) console.error(`Failed to spawn random food (all random positions tried had collision. attempts: ${tryCount}).`)
        return success;
    }

    _createRandomFood(vec) {
        const dangerFoodChance = 1 / 10000;
        const rainbowFoodChance = 1 / 3000;
        const umamiFoodChance = 1 / 1000;
        const rejuvenationFoodChance = 1 / 500;
        const goldenFoodChance = 1 / 200;

        if (Math.random() < dangerFoodChance) return this._createDangerFood(vec);
        if (Math.random() < rainbowFoodChance) return new Food(vec, 1, 1, FOOD_TYPE.RAINBOW);
        if (Math.random() < umamiFoodChance) return new Food(vec, 3, 3, FOOD_TYPE.UMAMI);
        if (Math.random() < rejuvenationFoodChance) return new Food(vec, 5, 0, FOOD_TYPE.REJUVENATION);
        if (Math.random() < goldenFoodChance) return new Food(vec, 10, 10, FOOD_TYPE.GOLDEN);
        else return this._createBasicFood(vec);
    }

    _createDangerFood(vec) {
        return new Food(vec, 0, 0, FOOD_TYPE.DANGER)
    }

    _createBasicFood(vec) {
        return new Food(vec, 1, 1, FOOD_TYPE.COMMON);
    }

    /**
     * @param {number} currentDirection 
     * @param {number} newDirection 
     * @returns {boolean}
     */
    _isValidInput(newDirection) {
        return DIRECTION.getOppositeDirection(this.currentDirection) != newDirection;
    }

    /**
     * 
     * @param {Vector2[]} vecList 
     * @param {Vector2} pos 
     * @returns {number}
     */
    _isCollidingCount(vecList, pos) {
        let count = 0;
        for (let i = 0; i < vecList.length; i++) {
            if (vecList[i].equals(pos)) {
                count += 1;
            }
        }
        return count;
    }

    /**
    * 
    * @param {Vector2[]} vecList 
    * @param {Vector2} pos 
    * @returns {number}
    */
    _isCollidingIndexes(vecList, pos) {
        let indexes = [];
        for (let i = 0; i < vecList.length; i++) {
            if (vecList[i].equals(pos)) {
                indexes.push(i)
            }
        }
        return indexes;
    }

    /**
     * @returns {boolean}
     */
    hasEffect(effect) {
        return this.getEffectDuration(effect) >= 0;
    }

    getEffectDuration(effect) {
        return this.effects.get(effect) || -1;
    }

    setEffectDuration(effect, duration) {
        this.effects.set(effect, duration);
    }

    applyEffect(effect, duration) {
        let currentDuration = this.getEffectDuration(effect);
        if (duration > currentDuration)
            this.setEffectDuration(effect, duration);
    }
}

class Food {
    /** @type {Vector2} */
    position
    /** @type {number} */
    score
    /** @type {number} */
    type

    /**
     * @param {Vector2} position 
     * @param {number} score 
     * @param {number} increaseSize
     * @param {number} type 
     */
    constructor(position, score = 1, increaseSize = 1, type = FOOD_TYPE.COMMON) {
        this.position = position;
        this.score = score;
        this.increaseSize = increaseSize;
        this.type = type;
    }
}

// ENTITIES
class Snake {
    /** @type {number} */
    _minLenght = 1;
    static HEAD_INDEX = 0;

    /** @type {Vector2[]} */
    _body;

    /**
     * @param {Vector2} initalPosition 
     */
    constructor(initalPosition) {
        this._body = [initalPosition];
    }

    /**
     * @returns {Vector2 | undefined}
     */
    getTail() {
        const bodyLenght = this._body.length;
        return bodyLenght > 1 ? this._body[this._body.length - 1] : undefined;
    }

    /**
     * @returns {Vector2}
     */
    getHead() {
        return this._body[Snake.HEAD_INDEX];
    }

    /**
    * @returns {Vector2[]}
    */
    getBodyOnly() {
        const tailIndex = this._body.length - 1;
        return this._body.slice(Snake.HEAD_INDEX + 1, tailIndex);
    }

    /**
    * @returns {Vector2[]}
    */
    getEntireBody() {
        return this._body;
    }

    increaseBody(times) {
        if (times < 0) this.decreaseBody(-times);
        for (let i = 0; i < times; i++) {
            let tail = this.getTail();
            let spawnPos = (tail !== undefined ? tail : this.getHead()).copy();
            this._body.push(spawnPos);
        }
    }

    decreaseBody(times) {
        if (times < 0) this.increaseBody(-times);
        for (let i = 0; i < times && this._body.length > 1; i++) {
            this._body.length -= 1;
        }
    }

    /** @param {Vector2} bounds {Vect} */
    warpHead(bounds) {
        var head = this.getHead();
        head.x = head.x >= 0 ? head.x % bounds.x : bounds.x - Math.abs(head.x % - bounds.x);
        head.y = head.y >= 0 ? head.y % bounds.y : bounds.y - Math.abs(head.y % - bounds.y);
    }

    /**
     * @param {Vector2} offset 
     */
    moveHead(offset) {
        this._moveBodyTowardsHead();
        let newPos = this.getHead().sum(offset)
        this._setHead(newPos);
    }

    /**
     * @param {Vector2} pos 
     */
    _setHead(pos) {
        this._body[Snake.HEAD_INDEX] = pos;
    }

    _moveBodyTowardsHead() {
        for (let i = this._body.length - 1; i > 0; i--) {
            this._body[i] = this._body[i - 1].copy();
        }
    }

    /**
     * 
     * @returns {number}
     */
    length() {
        return this._body.length;
    }
}

// OTHERS
class PixelRenderer {
    _fontConfig;

    /** @type {CanvasRenderingContext2D} */
    ctx;

    /** @type {Pixel[]} */
    pixelQueue;


    /**
     * @param {CanvasRenderingContext2D} ctx 
     */
    constructor(ctx, fontSize, fontName = "Consolas") {
        this.ctx = ctx;
        this.pixelQueue = [];
        this.fontName = fontName;
        this.setFont(fontSize);
    }

    setFont(size, fontName = this.fontName) {
        this._fontConfig = {
            // Proportion: 1:2
            font: `${size}px ${fontName}`, // NOT WEB SAFE
            fontWidth: size / 2,
            fontHeight: size,
        }
    }

    /**
    * @returns {Vector2}
    */
    getHowManyPixelsFitsOnTheCanvas() {
        return new Vector2(Math.floor(this.ctx.canvas.width / this._fontConfig.fontWidth), Math.floor(this.ctx.canvas.height / this._fontConfig.fontHeight));
    }

    /**
     * @param {Pixel[]} pixels
     */
    addPixelsToQueue(pixels) {
        pixels.forEach((pixel) => this._addPixelToQueue(pixel));
    }

    /**
    * @param {Pixel[]} pixels
    * @param {Vector2} offset
    */
    addPixelsToQueueWithOffset(pixels, offset) {
        pixels.forEach((pixel) => {
            pixel.position = pixel.position.sum(offset)
            this._addPixelToQueue(pixel)
        });
    }

    /**
     * @param {Pixel} pixel 
     */
    _addPixelToQueue(pixel) {
        this.pixelQueue.push(pixel);
    }

    renderPixelQueue() {
        this.pixelQueue.forEach((pixel) => this._renderPixel(pixel))
    }

    clearPixelQueue() {
        this.pixelQueue.length = 0;
    }

    /**
     * @param {Pixel} pixel 
     */
    _renderPixel(pixel) {
        this.ctx.save();

        this.ctx.fillStyle = pixel.style;
        this.ctx.font = this._fontConfig.font;

        let positionToDraw = pixel.position.sum(new Vector2(0, 1)).mul(new Vector2(this._fontConfig.fontWidth, this._fontConfig.fontHeight));

        this.ctx.fillText(pixel.character, positionToDraw.x, positionToDraw.y, undefined);

        this.ctx.restore();
    }
}

class Vector2 {
    /** @type {number} */
    x;
    /** @type {number} */
    y;

    /**
     * @param {number} x 
     * @param {number} y 
     */
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    /**
     * @param {Vector2} vec2 
     * @returns {Vector2}
     */
    sum(vec2) {
        return new Vector2(this.x + vec2.x, this.y + vec2.y);
    }

    /**
     * @param {Vector2} vec2 
     * @returns {Vector2}
     */
    sub(vec2) {
        return new Vector2(this.x - vec2.x, this.y - vec2.y);
    }

    /**
     * @param {Vector2} vec2 
     * @returns {Vector2}
     */
    mul(vec2) {
        return new Vector2(this.x * vec2.x, this.y * vec2.y);
    }

    /**
     * @param {Vector2} vec2 
     * @returns {Vector2}
     */
    div(vec2) {
        return new Vector2(this.x / vec2.x, this.y / vec2.y);
    }

    /**
     * @param {Vector2} vec2 
     * @returns {Vector2}
     */
    divFloor(vec2) {
        return new Vector2(Math.floor(this.x / vec2.x), Math.floor(this.y / vec2.y));
    }

    /**
     * @returns {Vector2}
     */
    copy() {
        return new Vector2(this.x, this.y);
    }

    /**
     * 
     * @param {Vector2} other 
     */
    equals(other) {
        return other.x == this.x && other.y == this.y;
    }

    toString() {
        return `{ x = ${this.x}, y = ${this.y}}`;
    }
}

class Pixel {
    /** @type {string} */
    character;
    /** @type {string} */
    style;
    /** @type {Vector2} */
    position;

    /**
     * @param {string} character 
     * @param {string} style
     * @param {Vector2} position 
     */
    constructor(character, style, position) {
        this.character = character.charAt(0);
        this.style = style
        this.position = position
    }

    /**
    * @param {string} string 
    * @param {string} style 
    * @param {Vector2} offset 
    * @returns {Pixel[]}
    */
    static createPixelsFromText(string, style, offset) {
        let pixels = []
        let lines = string.split("\n");

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            let line = lines[lineIndex];

            for (let charIndex = 0; charIndex < line.length; charIndex++) {
                let char = line.charAt(charIndex);
                let charPos = new Vector2(charIndex, lineIndex).sum(offset);
                let pixel = new Pixel(char, style, charPos);
                pixels.push(pixel);
            }
        }

        return pixels;
    }
}

class Box {
    /** @type {Vector2} */
    startPosition;
    /** @type {Vector2} */
    endPosition;

    /**
     * @param {Vector2} startPosition 
     * @param {Vector2} size 
     */
    constructor(startPosition, size) {
        if (size.x < 0 || size.y < 0) throw Error("Size cannot be smaller than 0");
        this.startPosition = startPosition.copy();
        this.endPosition = startPosition.sum(size);
    }
}

class GameRenderer {
    /** @type {Game} */
    game;

    /** @type {PixelRenderer} */
    pixelRender;

    /** @type {CanvasRenderingContext2D} */
    ctx;

    characters;
    colors;

    constructor(game, ctx, fontSize, characters, colors) {
        this.ctx = ctx;
        this.game = game;
        this.pixelRender = new PixelRenderer(ctx, fontSize);
        this.characters = characters;
        this.colors = colors;
        this.fps = 2;
        lastRenderTime = undefined;
    }

    render() {
        var realScreenSize = new Vector2(this.ctx.canvas.width, this.ctx.canvas.height);
        var screenPixelsSize = this.pixelRender.getHowManyPixelsFitsOnTheCanvas();
        var centerScreen = screenPixelsSize.divFloor(new Vector2(2, 2));
        var arenaSizeInPixels = this.game.arenaSize.mul(new Vector2(2, 1)).sub(new Vector2(1, 0));


        var gameOffset = centerScreen.sub(arenaSizeInPixels.divFloor(new Vector2(2, 2)));
        var renderOffset = new Vector2(realScreenSize.x / 2 % this.pixelRender._fontConfig.fontWidth, realScreenSize.y / 2 % this.pixelRender._fontConfig.fontHeight);
        var box = new Box(gameOffset.sub(new Vector2(2, 1)), arenaSizeInPixels.sum(new Vector2(3, 1)));

        let dateNow = new Date;

        const translations = [
            { toReplace: /\{snakeLength\}/g, value: this.game.snake.length() },
            { toReplace: /\{largestSnakeLength\}/g, value: this.game.largestSnakeSize },
            { toReplace: /\{score\}/g, value: this.game.score },
            { toReplace: /\{bestScore\}/g, value: this.game.bestScore },
            { toReplace: /\{deathCount\}/g, value: this.game.deathCount },
            { toReplace: /\{hour24\}/g, value: dateNow.getHours().toString().padStart(2, '0') },
            { toReplace: /\{hour12\}/g, value: (dateNow.getHours() % 12).toString().padStart(2, '0') },
            { toReplace: /\{AMPM\}/g, value: dateNow.getHours() < 12 ? "AM" : "PM" },
            { toReplace: /\{ampm\}/g, value: dateNow.getHours() < 12 ? "am" : "pm" },
            { toReplace: /\{minute\}/g, value: (dateNow.getMinutes()).toString().padStart(2, '0') },
            { toReplace: /\{second\}/g, value: (dateNow.getSeconds()).toString().padStart(2, '0') },
            { toReplace: /\\n|\{newline\}/g, value: "\n" },
            { toReplace: /\{fullYear\}/g, value: (dateNow.getFullYear()) },
            { toReplace: /\{twoDigitsYear\}/g, value: (dateNow.getFullYear() % 100).toString().padStart(2, '0') },
            { toReplace: /\{day\}/g, value: dateNow.getDay().toString().padStart(2, '0') },
            { toReplace: /\{month\}/g, value: dateNow.getMonth().toString().padStart(2, '0') },
        ]

        const specialCasesTranslations = [
            { toReplace: /\{whenDead:([\s\S]+?)\}/gi, value: "$1", condition: () => this.game.state == GAMESTATE.DEAD },
            { toReplace: /\{whenAlive:([\s\S]+?)\}/gi, value: "$1", condition: () => this.game.state == GAMESTATE.PLAYING },
            { toReplace: /\{whenNewBestScore:([\s\S]+?)\}/gi, value: "$1", condition: () => this.game.score > this.game.bestScore },
            { toReplace: /\{whenNewBestSneakLength:([\s\S]+?)\}/gi, value: "$1", condition: () => this.game.snake.length() > this.game.largestSnakeSize },
        ]

        let texts = this.game.texts
        let textArray = [
            new GameStringDisplay(texts.textBoxTopLeft.text, new Vector2(box.startPosition.x, box.startPosition.y - 1).sum(texts.textBoxTopLeft.pos), texts.textBoxTopLeft.anchor),
            new GameStringDisplay(texts.textBoxTopRight.text, new Vector2(box.endPosition.x, box.startPosition.y - 1).sum(texts.textBoxTopRight.pos), texts.textBoxTopRight.anchor),
            new GameStringDisplay(texts.textBoxBottomLeft.text, new Vector2(box.startPosition.x, box.endPosition.y + 1).sum(texts.textBoxBottomLeft.pos), texts.textBoxBottomLeft.anchor),
            new GameStringDisplay(texts.textBoxBottomRight.text, new Vector2(box.endPosition.x, box.endPosition.y + 1).sum(texts.textBoxBottomRight.pos), texts.textBoxBottomRight.anchor),
        ]
        textArray.forEach(s => {
            let str = s.text;
            translations.forEach(({ toReplace, value }) => {
                str = str.replace(toReplace, value);
            })

            specialCasesTranslations.forEach(({ toReplace, value, condition }) => {
                if (condition() === true) {
                    str = str.replace(toReplace, value);
                } else {
                    str = str.replace(toReplace, "");
                }
            });

            let pixels = this.stringToPixels(str, s.pos, this.colors.text, s.anchor);
            this.pixelRender.addPixelsToQueue(pixels);
        });

        // RENDER GAME
        var gamePixels = this.gameToPixels(this.game).map(p => {
            p.position = p.position.mul(new Vector2(2, 1));
            return p;
        });
        this.pixelRender.addPixelsToQueueWithOffset(gamePixels, gameOffset.copy());

        this.pixelRender.addPixelsToQueue(this.boxToPixels(box));

        this.ctx.save();
        this._clearCtxCanvasWithColor(this.colors.background);
        if (this.game.getUsingUserInput()) this._drawController();
        this.ctx.translate(renderOffset.x, renderOffset.y)
        this.pixelRender.renderPixelQueue();
        this.pixelRender.clearPixelQueue();
        this.ctx.restore();
    }

    _clearCtxCanvasWithColor() {
        this.ctx.save();

        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

        this.ctx.restore()
    }

    _drawController() {
        let screenSize = new Vector2(this.ctx.canvas.width, this.ctx.canvas.height);
        let screenCenter = new Vector2(Math.floor(screenSize.x / 2), Math.floor(screenSize.y / 2));

        // Draw Divisions
        this.ctx.save();
        let lineColor = rgbHexaToInt(this.colors.controller.line);
        this.ctx.strokeStyle = `rgba(${lineColor.r}, ${lineColor.g}, ${lineColor.b}, 0.1)`;

        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(screenSize.x, screenSize.y);
        this.ctx.closePath();
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(0, screenSize.y);
        this.ctx.lineTo(screenSize.x, 0);
        this.ctx.closePath();
        this.ctx.stroke();
        this.ctx.restore();

        let direction = this.game.getUsingUserInput() ? this.game.getLastUserInput() : this.game.currentDirection;

        let highlightColor = rgbHexaToInt(this.colors.controller.highlight);
        let color = `rgba(${highlightColor.r}, ${highlightColor.g}, ${highlightColor.b}, 0.03)`
        let size = Math.min(screenSize.x, screenSize.y) / 100 * 5;
        let lineWidth = size / 10;
        let arrowColor = `rgba(${lineColor.r}, ${lineColor.g}, ${lineColor.b}, 0.3)`;

        let smallerSide = Math.min(screenSize.x, screenSize.y);
        let smallerSideDivided = smallerSide / 4;

        // Draw highlight
        if (direction == DIRECTION.UP) {
            this.drawFilledTriangle(this.ctx, new Vector2(0, 0), screenCenter, new Vector2(screenSize.x, 0), color)
        }
        this.drawArrow(this.ctx, new Vector2(screenCenter.x, screenCenter.y - smallerSideDivided - size * 0.5), size, lineWidth, 0 * Math.PI * 2, arrowColor)
        if (direction == DIRECTION.LEFT) {
            this.drawFilledTriangle(this.ctx, new Vector2(0, 0), screenCenter, new Vector2(0, screenSize.y), color)
        }
        this.drawArrow(this.ctx, new Vector2(screenCenter.x - smallerSideDivided - size * 0.5, screenCenter.y), size, lineWidth, 0.75 * Math.PI * 2, arrowColor)
        if (direction == DIRECTION.DOWN) {
            this.drawFilledTriangle(this.ctx, new Vector2(0, screenSize.y), screenCenter, screenSize, color)
        }
        this.drawArrow(this.ctx, new Vector2(screenCenter.x, screenCenter.y + smallerSideDivided + size * 0.5), size, lineWidth, 0.50 * Math.PI * 2, arrowColor)
        if (direction == DIRECTION.RIGHT) {
            this.drawFilledTriangle(this.ctx, screenSize, screenCenter, new Vector2(screenSize.x, 0), color)
        }
        this.drawArrow(this.ctx, new Vector2(screenCenter.x + smallerSideDivided + size * 0.5, screenCenter.y), size, lineWidth, 0.25 * Math.PI * 2, arrowColor)
    }

    /**
    * @param {CanvasRenderingContext2D} ctx 
    * @param {Vector2} point1 
    * @param {Vector2} point2 
    * @param {Vector2} point3 
    * @param {string} style 
    */
    drawFilledTriangle(ctx, point1, point2, point3, style) {
        ctx.save();
        ctx.fillStyle = style;
        ctx.strokeStyle = style;

        ctx.beginPath();
        ctx.moveTo(point1.x, point1.y);
        ctx.lineTo(point2.x, point2.y);
        ctx.lineTo(point3.x, point3.y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    /**
     * 
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Vector2} position 
     * @param {number} size 
     * @param {number} direction 
     */
    drawArrow(ctx, position, size, lineWidth, rotation, style) {
        ctx.save();
        ctx.strokeStyle = style;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = "round";

        ctx.translate(position.x, position.y)
        ctx.rotate(rotation);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(- size / 2, size / 2)

        ctx.moveTo(0, 0);
        ctx.lineTo(size / 2, size / 2)

        ctx.moveTo(0, 0);
        ctx.lineTo(0, size)

        ctx.stroke();
        ctx.closePath()


        ctx.restore();
    }

    gameToPixels(game) {
        let snakePixels = this.snakeToPixels(game.snake);
        let foodPixels = game.foods.map(f => this.foodToPixels(f));

        let pixels = [...snakePixels, ...foodPixels];

        if (game.state == GAMESTATE.DEAD) {
            pixels.push(new Pixel(this.characters.deathLocation, this.colors.deathLocation, game.snake.getHead()));
        }

        return pixels;
    }

    /**
     * 
     * @param {Snake} snake 
     * @returns 
     */
    snakeToPixels(snake) {

        /** @type {Pixel[]} */
        let pixels = [];
        let snakeTail = snake.getTail();
        let snakeHead = snake.getHead();

        pixels.push(new Pixel(this.characters.snakeHead, this._decideSnakeColor(0), snakeHead.copy()));

        let bodyPixelsToRender;
        if (snakeTail != undefined) {
            bodyPixelsToRender = snake.getBodyOnly().filter(p => !p.equals(snakeTail) && !p.equals(snakeHead))
        } else {
            bodyPixelsToRender = snake.getBodyOnly().filter(p => !p.equals(snakeHead));
        }
        pixels.push(...bodyPixelsToRender.map((b, i) => new Pixel(this.characters.snakeBody, this._decideSnakeColor(i + 1), b.copy())));

        if (snakeTail !== undefined && !snakeTail.equals(snakeHead)) {
            pixels.push(new Pixel(this.characters.snakeTail, this._decideSnakeColor(snake.length() - 1), snakeTail.copy()));
        }

        return pixels;
    }

    /**
     * 
     * @param {Food} food 
     * @returns 
     */
    foodToPixels(food) {
        let color = this.getFoodColor(food.type);

        return new Pixel(this.getFoodCharacter(food.type), color, food.position);
    }

    getFoodColor(type) {
        let color;

        if (type == FOOD_TYPE.COMMON) color = this.colors.food.normal;
        else if (type == FOOD_TYPE.GOLDEN) color = this.colors.food.golden;
        else if (type == FOOD_TYPE.RAINBOW) {
            let pattern = this.colors.snake.customPatterns[this.game.tickCount % this.colors.snake.customPatterns.length];
            color = pattern[this.game.tickCount % pattern.length]
        }
        else if (type == FOOD_TYPE.UMAMI) color = this.colors.food.umami;
        else if (type == FOOD_TYPE.REJUVENATION) color = this.colors.food.rejuvenation;
        else if (type == FOOD_TYPE.DANGER) color = this.colors.food.danger;
        else color = this.colors.food.normal;

        return color;
    }

    getFoodCharacter(type) {
        let character;

        if (type == FOOD_TYPE.DANGER) character = this.characters.danger;
        else character = this.characters.food;

        return character;
    }

    boxToPixels(box) {
        let pixels = []
        let fixedBox = box;

        // top corners
        pixels.push(new Pixel(this.characters.borderTopCorner, this.colors.border, new Vector2(fixedBox.startPosition.x, fixedBox.startPosition.y)));
        pixels.push(new Pixel(this.characters.borderTopCorner, this.colors.border, new Vector2(fixedBox.endPosition.x, fixedBox.startPosition.y)));
        // bottom corners
        pixels.push(new Pixel(this.characters.borderBottomCorner, this.colors.border, new Vector2(fixedBox.startPosition.x, fixedBox.endPosition.y)));
        pixels.push(new Pixel(this.characters.borderBottomCorner, this.colors.border, new Vector2(fixedBox.endPosition.x, fixedBox.endPosition.y)));

        for (let i = fixedBox.startPosition.x + 1; i <= fixedBox.endPosition.x - 1; i++) {
            pixels.push(new Pixel(this.characters.borderHorizontalEdge, this.colors.border, new Vector2(i, fixedBox.startPosition.y)));
            pixels.push(new Pixel(this.characters.borderHorizontalEdge, this.colors.border, new Vector2(i, fixedBox.endPosition.y)));
        }

        for (let i = fixedBox.startPosition.y + 1; i <= fixedBox.endPosition.y - 1; i++) {
            pixels.push(new Pixel(this.characters.borderVerticalEdge, this.colors.border, new Vector2(fixedBox.startPosition.x, i)));
            pixels.push(new Pixel(this.characters.borderVerticalEdge, this.colors.border, new Vector2(fixedBox.endPosition.x, i)));
        }

        return pixels;
    }

    _decideSnakeColor(index) {
        const stripesLenght = 5;
        const dotsInterval = 2;

        if (this._getShouldFlash())
            return this.colors.snake.flash;

        let pattern = this._getCurrentSnakePattern();

        // Rainbow
        if (game.hasEffect(GAME_EFFECTS.INVINCIBILITY)) {
            let randomPattern = this.colors.snake.customPatterns[(this.game.tickCount + index) % this.colors.snake.customPatterns.length];
            let color = randomPattern[(this.game.tickCount + index) % randomPattern.length]
            return color;
        }

        if (game.hasEffect(GAME_EFFECTS.REJUVENATION) || game.hasEffect(GAME_EFFECTS.SHRINKING2)) {
            return this.colors.food.rejuvenation;
        }

        if (game.hasEffect(GAME_EFFECTS.NOT_GROWING)) {
            return this.colors.food.umami;
        }


        if (this.game.snakeSkin === SNAKE_SKIN.RAINBOW) {
            let i = index;
            return pattern[Math.floor(i) % pattern.length];
        }
        else if (this.game.snakeSkin === SNAKE_SKIN.SOLID || true) {
            return this.colors.snake.color;
        }
    }

    _getCurrentSnakePattern() {
            let pattern = this.colors.snake.customPatterns[this.game.deathCount % this.colors.snake.customPatterns.length];
            return pattern
    }

    /**
     * @param {number} duration 
     * @returns {boolean}
     */
    _getShouldFlash() {
        const flashTimeRemaining = 20;


        let smallerEffectTime = Infinity;
        game.effects.forEach((duration, effect) => {
            if (effect == GAME_EFFECTS.SHRINKING2) return;
            if (this.game.hasEffect(effect))
                smallerEffectTime = Math.min(smallerEffectTime, duration)
        });

        if (smallerEffectTime <= flashTimeRemaining) {
            return smallerEffectTime % 2 == 1;
        }
        return false;
    }

    /** @param {string} str */
    /** @param {Vector2} pos */
    /** @param {string} style */
    /** @param {number} anchor */
    stringToPixels(str, pos, style, anchor, color) {
        // TODO: Make it better
        let pixels = [];

        let yOffset = 0;
        let xOffset = 0;

        let xOffsetFixed = 0;
        let yOffsetFixed = 0;

        if (anchor == TEXT_ANCHOR.BOTTOM_LEFT || anchor == TEXT_ANCHOR.BOTTOM_RIGHT) {
            yOffsetFixed = -countLines(str);
        }

        if (anchor == TEXT_ANCHOR.BOTTOM_RIGHT || anchor == TEXT_ANCHOR.TOP_RIGHT) {
            xOffsetFixed = -calculateBiggestLineLenght(str) + 1;
        }

        for (let i = 0; i < str.length; i++) {
            let char = str.charAt(i);
            if (char == "\n") {
                yOffset += 1;
                xOffset = 0;
                continue;
            }

            let finalPos = pos.sum(new Vector2(xOffsetFixed + xOffset, yOffsetFixed + yOffset))

            pixels.push(new Pixel(char, style, finalPos));
            xOffset += 1;
        }

        return pixels;
    }
}

class GameStringDisplay {
    /**
     * @param {string} text 
     * @param {Vector2} pos 
     * @param {string} anchor
     */
    constructor(text, pos, anchor) {
        this.text = text;
        this.pos = pos;
        this.anchor = anchor;
    }
}

/**
 * @param {string} str 
 * @returns {number}
 */
function countLines(str) {
    let count = 0;
    for (let i = 0; i < str.length; i++) {
        if (str.charAt(i) === "\n") {
            count += 1;
        }
    }
    return count;
}

/**
 * @param {string} str 
 * @returns {number}
 */
function calculateBiggestLineLenght(str) {
    let biggestLineLength = 0;
    let currentLineLength = 0;
    for (let i = 0; i < str.length; i++) {
        if (str.charAt(i) === "\n") {
            biggestLineLength = Math.max(biggestLineLength, currentLineLength);
            currentLineLength = 0;
        } else {
            currentLineLength += 1;
        }
    }
    biggestLineLength = Math.max(biggestLineLength, currentLineLength);
    return biggestLineLength;
}

function rgbHexaToInt(hex) {
    let match = hex.match(/#?(?<r>[a-f\d]{2})(?<g>[a-f\d]{2})(?<b>[a-f\d]{2})/i);
    if (match === null) return null;
    return { r: parseInt(match.groups.r, 16), g: parseInt(match.groups.g, 16), b: parseInt(match.groups.b, 16) }
}