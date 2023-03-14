const $ = document.querySelectorAll.bind(document);
const c = console.log
let game;

class MenuScreen {
    constructor(){
        this.el
    }
    createScreen(){
        let menuScreenHTML = '<div class="menu-screen">'

        for(let i = 0; i<10; i++) {
            menuScreenHTML += `<ul>
                <li class="player-settings">
                    <label for="username-${i}">${game.text.menuScreenUserName}</label>
                    <input class="user-name" id="username-${i}" type="text" autocomplete="username" placeholder="${game.text.menuScreenUserName}" />
                    <label for="usercolor-${i}">${game.text.menuScreenUserColor}</label>
                    <input class="user-color" id="usercolor-${i}" type="color" />
                </li>
            </ul>`
        }

        menuScreenHTML += `<div><button id="start-game-btn">${game.text.menuScreenStartGameButton}</button></div></div>`

        game.elements.main.insertAdjacentHTML('beforeend', menuScreenHTML)

        this.el = $(".menu-screen")[0]

        
        this.el.querySelectorAll(".user-name")[0].value = "Speler 1"
        this.el.querySelectorAll(".user-name")[1].value = "Speler 2"

        $('#start-game-btn')[0].addEventListener("click", () => {
            $(".player-settings").forEach((el, id) => {
                const name = el.querySelector(".user-name").value
                const color = el.querySelector(".user-color").value

                if(name === "") return
                
                game.gameScreen.addPlayer({color, name, id})
            })

            game.elements.bottomUi.classList.remove('hidden')
            game.elements.game.classList.remove('hidden')

            this.destroyMenu()
            game.gameScreen.createBoard() 
        })
    }

    destroyMenu(){
        this.el.remove()
    }
}

class VictoryScreen {
    createScreen(players) {
        players.sort((a, b) => (a.finishedNumber > b.finishedNumber))

        let victoryScreenHTML = `
            <div>   
                <button>${game.text.victoryScreenNewGameButton}</button>
            </div>
            <ul>`

        players.forEach((p, index) => {
            victoryScreenHTML += `<li>${index}. ${p.name}</li>`
        })

        victoryScreenHTML += '</ul>'

        game.elements.main.insertAdjacentHTML('beforeend', victoryScreenHTML)
    }
}

class GameScreen {
    constructor() {
        this.tileRowHTML = '<div class="tile-row">'
        this.playerHTML = '<div class="player"></div>'
        this.players = []
        this.finishedPlayers = []
        this.tiles = []
        this.playerTurn = 0
        this.elements = {
            statusMessage: $('#status-messages')[0]
        }
    }
    
    startTestGame() {
        this.players.push({color: 'orange', name: 'Kees', id: 0})
        this.players.push({color: 'red', name: 'Bob', id: 1})
        this.players.push({color: 'purple', name: 'Jeff', id: 2})

        this.updateUI(game.text.playerTurnMessage.replace('{0}', this.players[this.playerTurn].name))
    }

    addPlayer(obj) {
        const newPlayer = new Player(obj.color, obj.name, obj.id)
        this.players.push(newPlayer)
        this.finishedPlayers.push(newPlayer)
    }

    createBoard(){
        let boardgameHTML = ''
        
        for(let i = 0; i < game.settings.height; i++) {
            boardgameHTML += this.tileRowHTML

            for(let j = 0; j < game.settings.width; j++) {
                const tileNumber = j + i * game.settings.height + 1

                boardgameHTML += `
                    <div class="tile" id="tile-${tileNumber}">
                        <p>${tileNumber}</p>
                    </div>`  

                this.tiles.push(new Tile(tileNumber))
            }

            boardgameHTML += '</div>'
        }

        game.elements.tiles.insertAdjacentHTML('beforeend', boardgameHTML)
        this.tiles.forEach(t => t.setTileId())
        
        game.elements.game.addEventListener('click', e => this.onPlayerClick(e))

        game.settings.snakes.forEach(s => {
            new Transport(
                this.tiles[s.beginTileIndex - 1],
                this.tiles[s.endTileIndex - 1]
            )
        })

        new Item(game.itemType.extraPoint)
    }

    movePlayerToTile(prop) {
        const player = this.players[prop.playerId]
        
        if(prop.tileIndex > 100) {
            player.setState(game.playerState.finished)
            player.finishedNumber = this.players.filter(p => p.playerState === game.playerState.finished).length
            player.removeSelf()

            this.players = this.players.filter(p => p.id !== player.id)
            
            if(player.finishedNumber === this.players.length) {
                this.destroyBoard()
                game.victoryScreen.createScreen(this.finishedPlayers)
                game.gameIsFinished = true
                return
            } 

            game.gameScreen.updateUI(game.text.playerWinsMessage.replace("{0}", player.name))
        } else {
            const tile = this.tiles[prop.tileIndex - 1]
            
            player.enters(tile)
            tile.enteredBy(player)
        }
    }
    
    destroyBoard(){
        game.elements.tiles.innerHTML = ''
        game.elements.transport.innerHTML = ''
    }

    newTurn() {
        const player = this.players[this.playerTurn]
        const diceNumber = this.throwDice(player)
        const diceMessage = game.text.diceThrowMessage.replace('{0}', player.name).replace('{1}', diceNumber)
        
        this.updateUI(diceMessage)

        ++this.playerTurn
        this.playerTurn = this.playerTurn %= this.players.length

        if(player.playerState !== game.playerState.finished && player.playerState !== game.playerState.frozen) {
            player.setState(game.playerState.throwDice)

            this.prepareNewPlayer()         
        }

       // player.powerPoints += 1
    }

    prepareNewPlayer(){
        const newPlayer = this.players[this.playerTurn]
        const playerTurnMessage = game.text.playerTurnMessage.replace('{0}', newPlayer.name)
        this.updateUI(playerTurnMessage)
        
        if(newPlayer.playerState !== game.playerState.finished && newPlayer.playerState !== game.playerState.frozen) {
            newPlayer.setState(game.playerState.awaitingPlayerAction)
        }

        if(newPlayer.playerState === game.playerState.frozen) {
            newPlayer.skipsATurn()
        }
        
        if(newPlayer.powerPoints >= 1) {
            newPlayer.addPowerPoints(-1)
            newPlayer.setState(game.playerState.useSpecialPower)
            this.updateUI(game.text[`playerCanUse${newPlayer.power}PowerMessage`].replace('{0}', newPlayer.name))
        }
    }
    
    throwDice(player){
        const diceNumber = Math.ceil(Math.random() * 6)
        const currentTileNumber = player.onTile?.index ?? 0

        this.movePlayerToTile({
            tileIndex: currentTileNumber + diceNumber,
            playerId: player.id
        })

        return diceNumber
    }

    onPlayerClick(e){
        const player = this.players[this.playerTurn]
        
        if(player.playerState !== game.playerState.useSpecialPower || player.onTile === undefined) {
            this.newTurn()
        } else {
            switch(player.power) {
                case game.playerPowers.freeze:
                    if(e.target.classList.contains('player')) {
                        const playerThatWasHitId = e.target.id.replace('player-', '')
                        const playerThatWasHit = this.players[playerThatWasHitId]
                        playerThatWasHit.freezePlayer()
                        player.setState(game.playerState.awaitingPlayerAction)
                        this.updateUI(game.text.playerFreezeMessage.replace('{0}', player.name).replace('{1}', playerThatWasHit.name))
                    }
                break
                case game.playerPowers.trap:
                    if(e.target.classList.contains('tile')) {
                        const tileThatWasHitId = parseInt(e.target.id.replace('tile-', ''))
                        const playerTileId = player.onTile.index
                        const allowedTileIds = [
                            playerTileId - 1, 
                            playerTileId + 1
                        ]

                        if(allowedTileIds.includes(tileThatWasHitId)) {
                            new Item(game.itemType.trap, tileThatWasHitId - 1, player)
                            player.setState(game.playerState.awaitingPlayerAction)
                            this.updateUI(game.text.playerLaysTrapMessage.replace('{0}', player.name)) 

                            // If there is a player on the selected tile, we want activate the trap
                            const playerOnTile = game.gameScreen.players.find(p => p.onTile?.index === tileThatWasHitId)
                            
                            if(playerOnTile !== undefined) game.gameScreen.tiles[tileThatWasHitId - 1].enteredBy(playerOnTile)
                        }
                    }
                break
                case game.playerPowers.shoot:
                    const tileThatWasHitId = parseInt(e.target.id.replace('tile-', ''))
                    const playerTileId = player.onTile.index
                    const allowedTileIds = [
                        playerTileId - 1, 
                        playerTileId + 1
                    ]

                    if(allowedTileIds.includes(tileThatWasHitId)) {
                        if(tileThatWasHitId > playerTileId){
                            const endOfLine = Math.ceil(tileThatWasHitId / game.settings.width) * game.settings.width

                            for(let i = tileThatWasHitId; i < endOfLine; i++) {
                                const playerOnTile = this.players.find(p => p.onTile?.index === i)

                                if(playerOnTile) {
                                    game.gameScreen.pushPlayerDown(playerOnTile, player)
                                }
                            }
                        } else {
                            const beginOfLine = Math.floor(tileThatWasHitId / game.settings.width) * game.settings.width

                            for(let i = tileThatWasHitId; i > beginOfLine; i--) {
                                const playerOnTile = this.players.find(p => p.onTile?.index === i)
                                
                                if(playerOnTile) {
                                    game.gameScreen.pushPlayerDown(playerOnTile, player)
                                }
                            }
                        }
                        
                        player.addPowerPoints(-1)
                        player.setState(game.playerState.awaitingPlayerAction)
                        this.updateUI(game.text.playerShootsMessage.replace('{0}', player.name))
                    }
                break
            }

        }
    }    

    pushPlayerDown(player, pushedByPlayer){
        player.entersTileByIndex(player.index - 20)
        player.setState(game.playerState.awaitingPlayerAction)
        game.gameScreen.updateUI(game.text.playerPushMessage.replace("{0}", player.name).replace("{1}", pushedByPlayer.name))
        pushedByPlayer.addPowerPoints(0.5)
    }

    updateUI(message) {
        this.elements.statusMessage.insertAdjacentHTML('afterbegin', `<li>${new Date().toLocaleTimeString()}: ${message}</li>`)
    }
}

class Tile {
    constructor(index){
        this.index = index
        this.usedByPlayer
        this.usedByTransport
        this.usedByItem
        this.el
    }

    setTileId(){
        this.el = $(`#tile-${this.index}`)[0]
    }

    enteredBy(player) {
        player.onTile?.playerLeaves()
        player.enters(this)
        this.usedByPlayer = player
        this.el.append(player.el)
        
        setTimeout(() => {
            if(this.usedByItem !== undefined) {
                if(this.usedByItem.type === game.itemType.extraPoint) {
                    player.addPowerPoints(1)
                    this.removeItem()
                    game.gameScreen.updateUI(game.text.playerGetsItemMessage.replace("{0}", player.name))

                    new Item(game.itemType.extraPoint)
                } else if(this.usedByItem.type === game.itemType.trap) {
                    const otherPlayer = this.usedByItem.ownedBy
                    game.gameScreen.pushPlayerDown(player, otherPlayer)
                    this.removeItem()

                    return
                }
            }

            const otherPlayerOntile = game.gameScreen.players.find(p => 
                p.id !== player.id && 
                player.onTile !== undefined && 
                p.onTile !== undefined &&
                p.onTile.index === player.onTile.index
            )

            if(otherPlayerOntile !== undefined) {
                otherPlayerOntile.entersTileByIndex(player.onTile.index - 20)
                game.gameScreen.updateUI(game.text.playerPushMessage.replace("{0}", player.name).replace("{1}", otherPlayerOntile.name))
                player.addPowerPoints(0.5)

                return
            } 

            if(this.usedByTransport?.direction === game.transportDirection.start){
                player.entersTileByIndex(this.usedByTransport.transport.endTile.index)
                game.gameScreen.updateUI(game.text.transportMessage.replace("{0}", player.name))
            }
        }, 500)
    }

    playerLeaves(){
        this.usedByPlayer = undefined
    }

    setTransport(transport, direction) {
        this.usedByTransport = {
            transport,
            direction
        }
    }

    addItem(item){
        this.usedByItem = item
        this.el.insertAdjacentHTML('beforeend', item.html)
    }

    removeItem(){
        this.el.querySelector(".item").remove()
        this.usedByItem = undefined
    }
}

class Transport {
    constructor(startTile, endTile){
        this.startTile = startTile
        this.endTile = endTile
        this.id = crypto.randomUUID()
        this.el

        this.drawLine()
        this.setTileConnection()
    }

    setTileConnection(){
        this.startTile.setTransport(this, game.transportDirection.start)
        this.endTile.setTransport(this, game.transportDirection.end)
    }

    drawLine() {
        this.el?.remove()
        
        const startTileBR = this.startTile.el.getBoundingClientRect()
        const endTileBR = this.endTile.el.getBoundingClientRect()
        let tileCenterFromBorder = startTileBR.width / 2
        let x1 = startTileBR.x + tileCenterFromBorder
        let x2 = endTileBR.x + tileCenterFromBorder
        let y1 = startTileBR.y + tileCenterFromBorder
        let y2 = endTileBR.y + tileCenterFromBorder

        if (x2 < x1) {
            let tmp
            tmp = x2 ; x2 = x1 ; x1 = tmp
            tmp = y2 ; y2 = y1 ; y1 = tmp
        }
        
        const lineLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
        const m = (y2 - y1) / (x2 - x1)
        const degree = Math.atan(m) * 180 / Math.PI
        const lineId = `line-${this.id}`
        const verticalDirection = startTileBR.y < endTileBR.y ? game.transportDirection.down : game.transportDirection.up
        const horizontalDirection = startTileBR.x < endTileBR.x ? game.transportDirection.right : game.transportDirection.left
    
        game.elements.transport.innerHTML += `
            <div 
                class="line"
                id="${lineId}"
                data-horizontal-direction="${horizontalDirection}"
                data-vertical-direction="${verticalDirection}"
                style="
                    transform: rotate(${degree}deg);
                    width: ${lineLength}px; 
                    top: ${y1 - 5}px; 
                    left: ${x1}px;
                " 
            >
            </div>`

        this.el = $(`#${lineId}`)
    }
}

class Item {
    constructor(type, index, ownedBy){
        this.id = crypto.randomUUID()
        this.type = type
        this.ownedBy = ownedBy
        this.html = `
            <div
                class="item"
                data-type="${this.type}"
            ></div>`

        this.addToBoard(index)
    }

    addToBoard(index){
        const tileIndex = index ??  Math.floor(Math.random() * game.gameScreen.tiles.length)
        const tileToAddItemTo = game.gameScreen.tiles[tileIndex]

        tileToAddItemTo.addItem(this)
    }
}

class Player {
    constructor(color, name, id){
        this.color = color
        this.name = name
        this.id = id
        this.onTile
        this.finishedNumber
        this.freezeTurns = 0
        this.powerPoints = 0
        this.playerState = game.playerState.awaitingPlayerAction
        this.power = game.playerPowers[Object.keys(game.playerPowers)[Math.floor(Math.random()*Object.keys(game.playerPowers).length)]]

        game.gameScreen.updateUI(game.text.playerGainsPowerMessage.replace('{0}', this.name).replace('{1}', this.power))

        this.putPlayerNextToGameboard()
    }

    enters(tile){
        this.onTile = tile
    }

    skipsATurn(){
        --this.freezeTurns
        game.gameScreen.updateUI(game.text.playerSkipsATurnMessage.replace('{0}', this.name))

        if(this.freezeTurns === 0) {
            this.playerState = game.playerState.awaitingPlayerAction
        }
    }

    freezePlayer() {
        this.freezeTurns += 2
        this.playerState = game.playerState.frozen
        game.gameScreen.updateUI(game.text.playerIsFrozenMessage.replace('{0}', this.name))
    }

    addPowerPoints(pointAmt){
        this.powerPoints += pointAmt
    }

    putPlayerNextToGameboard(){
        this.onTile = undefined
        game.elements.main.insertAdjacentHTML('beforeend', `<div class="player" id="player-${this.id}" style="background-color: ${this.color}">${this.name[0]}</div>`)
        this.el = $(`#player-${this.id}`)[0]
    }

    leaveGameBoard(){
        this.el.remove()
        this.putPlayerNextToGameboard()
    }

    entersTileByIndex(index){
        const newTile = game.gameScreen.tiles[index - 1]
       
        this.onTile?.playerLeaves()

        if(newTile === undefined) this.leaveGameBoard()
        else newTile.enteredBy(this)
    }

    setState(newState){
        this.playerState = newState
    }

    removeSelf(){
        this.el.remove()
    }
}

function Game() {
    this.text = {
        playerTurnMessage: '{0} is aan de beurt',
        diceThrowMessage: '{0} gooit {1}',
        playerPushMessage: '{0} gooit {1} 20 plekken naar beneden',
        transportMessage: '{0} komt op een slang',
        playerWinsMessage: '{0} is uit',
        victoryScreenNewGameButton: 'Nieuw spel',
        menuScreenUserColor: 'Speler kleur:',
        menuScreenUserName: 'Speler naam:',
        menuScreenStartGameButton: 'Start spel',
        playerGetsItemMessage: '{0} krijgt een punt',
        playerCanUsefreezePowerMessage: '{0} kan op een speler klikken om die te bevriezen',
        playerCanUsetrapPowerMessage: '{0} kan op een tile rondom klikken om een val neer te leggen',
        playerCanUsesnakePowerMessage: '{0} kan op een slang klikken om te verplaatsen',
        playerCanUseshootPowerMessage: '{0} kan op een tile rondom klikken om te schieten',
        playerIsFrozenMessage: '{0} is voor 2 beurten bevroren',
        playerSkipsATurnMessage: '{0} slaat een beurt over',
        playerShootsMessage: '{0} schiet',
        playerLaysTrapMessage: '{0} legt een val',
        playerFreezeMessage: '{0} bevriest {1}',
        playerGainsPowerMessage: '{0} heeft de {1} power'
    }
    this.playerPowers = {
        freeze: 'freeze',
        trap: 'trap',
        shoot: 'shoot'
    }
    this.screen = {
        menu: 'menu', 
        game: 'game', 
        victory: 'victory'
    }
    this.itemType = {
        extraPoint: 'extraPoint',
        trap: 'trap'
    }
    this.transportDirection = {
        end: 'end',
        start: 'start',
        up: 'up',
        down: 'down',
        left: 'left',
        right: 'right'
    }
    this.playerState = {
        awaitingPlayerAction: 'awaitingPlayerAction', 
        finished: 'finished', 
        frozen: 'frozen',
        throwDice: 'throwDice', 
        useSpecialPower: 'useSpecialPower',
        menuScreenUserNamePlacholder: 'Spelersnaam'
    }
    this.menuScreen = new MenuScreen()
    this.gameScreen = new GameScreen()
    this.victoryScreen = new VictoryScreen()
    this.settings = {
        width: 10,
        height: 10,
        playerAmount: 2,
        snakes: [
            {
                beginTileIndex: 2,
                endTileIndex: 37
            },
            {
                beginTileIndex: 8,
                endTileIndex: 32
            },
            {
                beginTileIndex: 33,
                endTileIndex: 6
            },
            {
                beginTileIndex: 42,
                endTileIndex: 20
            },
            {
                beginTileIndex: 49,
                endTileIndex: 10
            },
            {
                beginTileIndex: 51,
                endTileIndex: 68
            },
            {
                beginTileIndex: 56,
                endTileIndex: 48
            },
            {
                beginTileIndex: 61,
                endTileIndex: 79
            },
            {
                beginTileIndex: 62,
                endTileIndex: 5
            },
            {
                beginTileIndex: 65,
                endTileIndex: 84
            },
            {
                beginTileIndex: 71,
                endTileIndex: 92
            },
            {
                beginTileIndex: 81,
                endTileIndex: 96
            },
            {
                beginTileIndex: 87,
                endTileIndex: 16
            },
            {
                beginTileIndex: 93,
                endTileIndex: 74
            },
            {
                beginTileIndex: 95,
                endTileIndex: 76
            },
            {
                beginTileIndex: 98,
                endTileIndex: 64
            }
        ]
    }
    this.gameIsFinished = false
    this.elements = {
        game: $('#game')[0],
        main: $('main')[0],
        tiles: $('#tiles')[0],
        transport: $('#transport')[0],
        bottomUi: $('#bottom-ui')[0]
    }
}

document.addEventListener('DOMContentLoaded', () => {
    game = new Game()

    //  this.gameScreen.startTestGame() 
    //  game.gameScreen.createBoard()
    game.menuScreen.createScreen()
});