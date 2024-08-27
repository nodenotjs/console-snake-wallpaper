'use strict';
var debug = true;

/** @type {CanvasRenderingContext2D} */
const canvasRenderContext = document.getElementById('game-canvas').getContext('2d');
/** @type {Game} */
var game;
/** @type {GameRenderer} */
var gameRenderer;

var settings = {
    arenaSize: new Vector2(16, 16),
    maxFood: 8,
    initFoodOnInit: false,
    wallWarp: true,
    gameTickInterval: 150,
    deathInterval: 5000,
    fontSize: 32,
    initalSnakeSize: 3,
    snakeSkin: SNAKE_SKIN.STRIPES,
    /** @type {GameStringDisplay[]} */
    texts: [],
    /** @type {GameStringDisplay} */
    textBoxTopLeft: new GameStringDisplay("Score: {score}", new Vector2(), TEXT_ANCHOR.BOTTOM_LEFT),
    /** @type {GameStringDisplay} */
    textBoxTopRight: new GameStringDisplay("Best Score: {bestScore}", new Vector2(), TEXT_ANCHOR.BOTTOM_RIGHT),
    /** @type {GameStringDisplay} */
    textBoxBottomLeft: new GameStringDisplay("Snake Length: {snakeLength}", new Vector2(), TEXT_ANCHOR.TOP_LEFT),
    /** @type {GameStringDisplay} */
    textBoxBottomRight: new GameStringDisplay("Deaths: {deathCount}", new Vector2(), TEXT_ANCHOR.TOP_RIGHT),
    playerController: false,
    syncFpsWithGameTick: true,
    bypassFpsIfControllerIsEnabled: true,
}

var wallpaperEngineGeneralSettings = {
    fpsLimit: 60
}

var chars = {
    snakeHead: "0",
    snakeBody: "o",
    snakeTail: ".",
    food: "*",
    danger: "!",
    deathLocation: "X",
    borderTopCorner: " ",
    borderBottomCorner: "'",
    borderHorizontalEdge: "-",
    borderVerticalEdge: "'",
}

const colors = {
    background: "#1E2030",
    food: {
        normal: "#8EACFF",
        golden: "#CC8E4D",
        umami: "#E8C683",
        rejuvenation: "#E883E3",
        danger: "#ED736E",
    },
    deathLocation: "#F79568",
    border: "#939393",
    text: "#D6DEF9",
    snake: {
        color: "#C9E883",
        customPatterns: [
            [
                "#E88383",
                "#E8C683",
                "#C9E883",
                "#83E8E6",
                "#8385E8",
                "#E883E3",]
        ],
        flash: "#ffffff",
    },
    controller: {
        line: "#FFFFFF",
        highlight: "#7878FF"
    }
}

function init() {
    initVars();
    initCanvas();
    initEventHandlers();

    game.startTicking();
    renderLoop();
}

function reload() {
    game.clearNextTickTimeout();

    initVars();

    game.startTicking();
}

function initVars() {
    game = new Game(settings);
    gameRenderer = new GameRenderer(game, canvasRenderContext, settings.fontSize, chars, colors);
}

function initCanvas() {
    makeCtxCanvasFullScreen();
}

function initEventHandlers() {
    window.addEventListener("resize", () => { makeCtxCanvasFullScreen(); })
}

var lastRenderTime = undefined;
var lastTickCount = undefined;
function renderLoop() {
    let mustRender = false;
    if (game !== undefined && settings.bypassFpsIfControllerIsEnabled == true && game.getUsingUserInput() == true) {
        // console.log("bypassing fps limit")
        mustRender = true;
    }
    if (game !== undefined && settings.syncFpsWithGameTick == true && game.state == GAMESTATE.PLAYING) {
        if (game.tickCount != lastTickCount || performance.now() > lastRenderTime + 1000) {
            // console.log("syncing fps")
            mustRender = true;
        }
    } else if (lastRenderTime === undefined || performance.now() > lastRenderTime + (1 / wallpaperEngineGeneralSettings.fpsLimit * 1000)) {
        // console.log("wallpaper engine fps")
        mustRender = true;
    } else {
        // console.log("not rendering")
    }

    if (mustRender) {
        gameRenderer.render();
        lastRenderTime = performance.now();
        if (game !== undefined) lastTickCount = game.tickCount;
    }

    requestAnimationFrame(() => renderLoop());
}

function makeCtxCanvasFullScreen() {
    canvasRenderContext.canvas.width = document.body.clientWidth;
    canvasRenderContext.canvas.height = document.body.clientHeight;
}

/**
 * @param {Number} direction 
 */
function directionToVector(direction) {
    switch (direction) {
        case DIRECTION.UP:
            return new Vector2(0, -1);
        case DIRECTION.DOWN:
            return new Vector2(0, 1);
        case DIRECTION.LEFT:
            return new Vector2(-1, 0);
        case DIRECTION.RIGHT:
            return new Vector2(1, 0);

        default:
            console.error("invalid direciton to vector")
            return undefined;
    }
}
let mouseDown = false;
canvasRenderContext.canvas.addEventListener("mousedown", (e) => { mouseDown = true; processUserInput(e); });
canvasRenderContext.canvas.addEventListener("mouseup", () => mouseDown = false);
canvasRenderContext.canvas.addEventListener("mousemove", (e) => { if (mouseDown === true) processUserInput(e); })


function processUserInput(e) {
    if (game === undefined) return;

    let mouseX = e.clientX;
    let mouseY = e.clientY;

    let screenSize = new Vector2(canvasRenderContext.canvas.width, canvasRenderContext.canvas.height);
    let screenCenter = new Vector2(Math.floor(screenSize.x / 2), Math.floor(screenSize.y / 2));
    let mousePos = new Vector2(mouseX, mouseY);

    let mousePosFromCenter = mousePos.sub(screenCenter);
    let corner1FromCenter = new Vector2(0, 0).sub(screenCenter);
    let corner2FromCenter = new Vector2(screenSize.x, 0).sub(screenCenter);
    let corner3FromCenter = new Vector2(screenSize.x, screenSize.y).sub(screenCenter);
    let corner4FromCenter = new Vector2(0, screenSize.y).sub(screenCenter);

    let mouseRotation = Math.atan2(mousePosFromCenter.x, mousePosFromCenter.y) / 2 / Math.PI + 0.5;

    let corner1Rotation = Math.atan2(corner1FromCenter.x, corner1FromCenter.y) / 2 / Math.PI + 0.5;
    let corner2Rotation = Math.atan2(corner4FromCenter.x, corner4FromCenter.y) / 2 / Math.PI + 0.5;
    let corner3Rotation = Math.atan2(corner3FromCenter.x, corner3FromCenter.y) / 2 / Math.PI + 0.5;
    let corner4Rotation = Math.atan2(corner2FromCenter.x, corner2FromCenter.y) / 2 / Math.PI + 0.5;

    let direction;
    if (mouseRotation < corner1Rotation || mouseRotation >= corner4Rotation)
        direction = DIRECTION.UP;
    else if (mouseRotation >= corner3Rotation)
        direction = DIRECTION.RIGHT;
    else if (mouseRotation >= corner2Rotation)
        direction = DIRECTION.DOWN;
    else if (mouseRotation >= corner1Rotation)
        direction = DIRECTION.LEFT;
    else {
        console.error("invalid input", direction)
        direction = DIRECTION.UP;
    }

    game.handleUserInput(direction);
}

window.wallpaperPropertyListener = {
    applyUserProperties: function (properties) {


        if (properties.arenawidth !== undefined) {
            settings.arenaSize.x = parseInt(properties.arenawidth.value);
            // requireFullReload = true;
            if (game !== undefined) {
                game.arenaSize.x = settings.arenaSize.x;
                game.state = GAMESTATE.INITALIZING;
            }
        }

        if (properties.arenaheight !== undefined) {
            settings.arenaSize.y = parseInt(properties.arenaheight.value);
            // requireFullReload = true;
            if (game !== undefined) {
                game.arenaSize.y = settings.arenaSize.y;
                game.state = GAMESTATE.INITALIZING;
            }
        }

        if (properties.maxfoodinarena !== undefined) {
            settings.maxFood = parseInt(properties.maxfoodinarena.value);
            if (game !== undefined) game.foodMaxAmmount = settings.maxFood;
        }

        if (properties.initfoodoninit !== undefined) {
            settings.initFoodOnInit = properties.initfoodoninit.value;
        }

        if (properties.wallwarp !== undefined) {
            settings.wallWarp = properties.wallwarp.value;
            if (game !== undefined) game.wallWarps = settings.wallWarp;
        }

        if (properties.gametickinterval !== undefined) {
            settings.gameTickInterval = parseInt(properties.gametickinterval.value);
            if (game !== undefined) game.gameTickInterval = settings.gameTickInterval;
        }

        if (properties.deathinterval !== undefined) {
            settings.deathInterval = parseFloat(properties.deathinterval.value) * 1000;
            if (game !== undefined) game.deathInterval = settings.deathInterval;

        }

        if (properties.fontsize !== undefined) {
            settings.fontSize = parseFloat(properties.fontsize.value);
            if (gameRenderer !== undefined) gameRenderer.pixelRender.setFont(settings.fontSize)
        }
        if (properties.initalsnakesize !== undefined) {
            settings.initalSnakeSize = parseInt(properties.initalsnakesize.value);
            if (game !== undefined) game.initalSnakeSize = settings.initalSnakeSize;
        }

        if (properties.snakeskin !== undefined) {
            settings.snakeSkin = parseInt(properties.snakeskin.value);
            if (game !== undefined) game.snakeSkin = settings.snakeSkin;
        }

        if (properties.playercontroller !== undefined) {
            settings.playerController = properties.playercontroller.value;
            if (game !== undefined) game.setUsingUserInput(settings.playerController);
        }


        if (properties.syncfpswithgametick !== undefined) {
            settings.syncFpsWithGameTick = properties.syncfpswithgametick.value;
        }


        if (properties.bypassfpslimitwhenplayercontrollerisenabled !== undefined) {
            settings.bypassFpsIfControllerIsEnabled = properties.bypassfpslimitwhenplayercontrollerisenabled.value;
        }

        // TEXTS
        // textBoxTopLeft

        if (properties.textboxtoplefttext !== undefined) {
            settings.textBoxTopLeft.text = properties.textboxtoplefttext.value;
            if (game !== undefined) game.texts.textBoxTopLeft.text = settings.textBoxTopLeft.text;
        }

        if (properties.textboxtopleftpositionoffsetx !== undefined) {
            settings.textBoxTopLeft.pos.x = properties.textboxtopleftpositionoffsetx.value;
            if (game !== undefined) game.texts.textBoxTopLeft.pos.x = settings.textBoxTopLeft.pos.x;
        }

        if (properties.textboxtopleftpositionoffsety !== undefined) {
            settings.textBoxTopLeft.pos.y = properties.textboxtopleftpositionoffsety.value;
            if (game !== undefined) game.texts.textBoxTopLeft.pos.y = settings.textBoxTopLeft.pos.y;
        }

        // textBoxTopRight

        if (properties.textboxtoprighttext !== undefined) {
            settings.textBoxTopRight.text = properties.textboxtoprighttext.value;
            if (game !== undefined) game.texts.textBoxTopRight.text = settings.textBoxTopRight.text;
        }

        if (properties.textboxtoprightpositionoffsetx !== undefined) {
            settings.textBoxTopRight.pos.x = properties.textboxtoprightpositionoffsetx.value;
            if (game !== undefined) game.texts.textBoxTopRight.pos.x = settings.textBoxTopRight.pos.x;
        }

        if (properties.textboxtoprightpositionoffsety !== undefined) {
            settings.textBoxTopRight.pos.y = properties.textboxtoprightpositionoffsety.value;
            if (game !== undefined) game.texts.textBoxTopRight.pos.y = settings.textBoxTopRight.pos.y;
        }

        // textBoxBottomLeft

        if (properties.textboxbottomlefttext !== undefined) {
            settings.textBoxBottomLeft.text = properties.textboxbottomlefttext.value;
            if (game !== undefined) game.texts.textBoxBottomLeft.text = settings.textBoxBottomLeft.text;
        }

        if (properties.textboxbottomleftpositionoffsetx !== undefined) {
            settings.textBoxBottomLeft.pos.x = properties.textboxbottomleftpositionoffsetx.value;
            if (game !== undefined) game.texts.textBoxBottomLeft.pos.x = settings.textBoxBottomLeft.pos.x;
        }

        if (properties.textboxbottomleftpositionoffsety !== undefined) {
            settings.textBoxBottomLeft.pos.y = properties.textboxbottomleftpositionoffsety.value;
            if (game !== undefined) game.texts.textBoxBottomLeft.pos.y = settings.textBoxBottomLeft.pos.y;
        }

        // textBoxBottomRight

        if (properties.textboxbottomrighttext !== undefined) {
            settings.textBoxBottomRight.text = properties.textboxbottomrighttext.value;
            if (game !== undefined) game.texts.textBoxBottomRight.text = settings.textBoxBottomRight.text;
        }

        if (properties.textboxbottomrightpositionoffsetx !== undefined) {
            settings.textBoxBottomRight.pos.x = properties.textboxbottomrightpositionoffsetx.value;
            if (game !== undefined) game.texts.textBoxBottomRight.pos.x = settings.textBoxBottomRight.pos.x;
        }

        if (properties.textboxbottomrightpositionoffsety !== undefined) {
            settings.textBoxBottomRight.pos.y = properties.textboxbottomrightpositionoffsety.value;
            if (game !== undefined) game.texts.textBoxBottomRight.pos.y = settings.textBoxBottomRight.pos.y;
        }


        // characters

        if (properties.snakeheadcharacter !== undefined) {
            chars.snakeHead = properties.snakeheadcharacter.value;
            if (gameRenderer !== undefined) gameRenderer.characters.snakeHead = chars.snakeHead;
        }

        if (properties.snakebodycharacter !== undefined) {
            chars.snakeBody = properties.snakebodycharacter.value;
            if (gameRenderer !== undefined) gameRenderer.characters.snakeBody = chars.snakeBody;
        }

        if (properties.snaketailcharacter !== undefined) {
            chars.snakeTail = properties.snaketailcharacter.value;
            if (gameRenderer !== undefined) gameRenderer.characters.snakeTail = chars.snakeTail;
        }

        if (properties.foodcharacter !== undefined) {
            chars.food = properties.foodcharacter.value;
            if (gameRenderer !== undefined) gameRenderer.characters.food = chars.food;
        }

        if (properties.fooddangercharacter !== undefined) {
            chars.danger = properties.fooddangercharacter.value;
    
            if (gameRenderer !== undefined) gameRenderer.characters.danger = chars.danger;
        }

        if (properties.deathlocationcharacter !== undefined) {
            chars.deathLocation = properties.deathlocationcharacter.value;
            if (gameRenderer !== undefined) gameRenderer.characters.deathLocation = chars.deathLocation;
        }

        if (properties.bordertopcornercharacter !== undefined) {
            chars.borderTopCorner = properties.bordertopcornercharacter.value;
            if (gameRenderer !== undefined) gameRenderer.characters.borderTopCorner = chars.borderTopCorner;
        }

        if (properties.borderbottomcornercharacter !== undefined) {
            chars.borderBottomCorner = properties.borderbottomcornercharacter.value;
            if (gameRenderer !== undefined) gameRenderer.characters.borderBottomCorner = chars.borderBottomCorner;
        }

        if (properties.borderhorizontaledgecharacter !== undefined) {
            chars.borderHorizontalEdge = properties.borderhorizontaledgecharacter.value;
            if (gameRenderer !== undefined) gameRenderer.characters.borderHorizontalEdge = chars.borderHorizontalEdge;
        }

        if (properties.borderverticaledgecharacter !== undefined) {
            chars.borderVerticalEdge = properties.borderverticaledgecharacter.value;
            if (gameRenderer !== undefined) gameRenderer.characters.borderVerticalEdge = chars.borderVerticalEdge;
        }

        // colors

        if (properties.controllerlinecolor !== undefined) {
            colors.controller.line = colorPropertyToHex(properties.controllerlinecolor.value);
            if (gameRenderer !== undefined) gameRenderer.colors.controller.line = colors.controller.line;
        }

        if (properties.controllerhighlightcolor !== undefined) {
            colors.controller.highlight = colorPropertyToHex(properties.controllerhighlightcolor.value);
            if (gameRenderer !== undefined) gameRenderer.colors.controller.highlight = colors.controller.highlight;
        }

        if (properties.backgroundcolor !== undefined) {
            colors.background = colorPropertyToHex(properties.backgroundcolor.value);
            if (gameRenderer !== undefined) gameRenderer.colors.background = colors.background;
        }

        if (properties.foodnormalcolor !== undefined) {
            colors.food.normal = colorPropertyToHex(properties.foodnormalcolor.value);
            if (gameRenderer !== undefined) gameRenderer.colors.food.normal = colors.food.normal;
        }

        if (properties.fooddangercolor !== undefined) {
            colors.food.danger = colorPropertyToHex(properties.fooddangercolor.value);
            if (gameRenderer !== undefined) gameRenderer.colors.food.danger = colors.food.danger;
        }

        if (properties.foodgoldencolor !== undefined) {
            colors.food.golden = colorPropertyToHex(properties.foodgoldencolor.value);
            if (gameRenderer !== undefined) gameRenderer.colors.food.golden = colors.food.golden;
        }

        if (properties.foodumamicolor !== undefined) {
            colors.food.umami = colorPropertyToHex(properties.foodumamicolor.value);
            if (gameRenderer !== undefined) gameRenderer.colors.food.umami = colors.food.umami;
        }

        if (properties.foodrejuvenationcolor !== undefined) {
            colors.food.rejuvenation = colorPropertyToHex(properties.foodrejuvenationcolor.value);
            if (gameRenderer !== undefined) gameRenderer.colors.food.rejuvenation = colors.food.rejuvenation;
        }

        if (properties.deathlocationcolor !== undefined) {
            colors.deathLocation = colorPropertyToHex(properties.deathlocationcolor.value);
            if (gameRenderer !== undefined) gameRenderer.colors.deathLocation = colors.deathLocation;
        }

        if (properties.bordercolor !== undefined) {
            colors.border = colorPropertyToHex(properties.bordercolor.value);
            if (gameRenderer !== undefined) gameRenderer.colors.border = colors.border;
        }

        if (properties.textcolor !== undefined) {
            colors.text = colorPropertyToHex(properties.textcolor.value);
            if (gameRenderer !== undefined) gameRenderer.colors.text = colors.text;
        }

        if (properties.snakecolorsprimarycolor !== undefined) {
            colors.snake.color = colorPropertyToHex(properties.snakecolorsprimarycolor.value);
            if (gameRenderer !== undefined) gameRenderer.colors.snake.color = colors.snake.color;
        }

        if (properties.snakeflashcolor !== undefined) {
            colors.snake.flash = colorPropertyToHex(properties.snakeflashcolor.value);
            if (gameRenderer !== undefined) gameRenderer.colors.snake.flash = colors.snake.flash;
        }


        if (properties.snakecustompatterncolors !== undefined) {
            let patterns = properties.snakecustompatterncolors.value.split("|").map(x => hexesToArray(x)).filter(x => x != null);
            if (patterns.length === 0) {
                patterns = [colors.snake.color]
            }

            colors.snake.customPatterns = patterns;
            if (gameRenderer !== undefined) gameRenderer.colors.snake.customPatterns = colors.snake.customPatterns;
        }
    },

    applyGeneralProperties: (properties) => {
        if (properties.fps !== undefined) {
            wallpaperEngineGeneralSettings.fpsLimit = properties.fps;
        }
    }
}

function colorPropertyToHex(propertyValue) {
    return "#" + propertyValue.split(" ").map(x => Math.floor(parseFloat(x) * 255).toString(16).padStart(2, "0").toUpperCase()).join("")
}

function hexesToArray(str) {
    return str.match(/#(?:[A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/g)
}

init();