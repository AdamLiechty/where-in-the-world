import React, { Component } from 'react'
import { normalizeLng, openTab } from './utils'
import { minLevel, maxLevel, levelSeconds, endOfLocationPause } from './constants'

export default class PlayGame extends Component {
  constructor() {
    super()
    this.state = { }
  }
  render() {
    const { gameDefinition, game } = this.state

    return (
      <div>
        { gameDefinition ?
          <div>
            <h1>{gameDefinition.name}</h1>
            <div>Note: This tab must remain open to drive the game.</div>
            { game ?
              <div>
                <h2>State: {game.state}</h2>
                <div><button onClick={() => this.openBigScreen(game)}>Open big screen</button></div>
                { this.renderGame(game) }
              </div>
              : <div>Loading...</div>
            }
          </div>
          : <div>Loading...</div>}
      </div>
    )
  }

  renderGame() {
    const { game, gameDefinition } = this.state
    switch (game.state) {
      case 'OPEN':
        return (
          <div>
            <div>Location index: {game.locationIndex}</div>
            <div>Level: {game.level}</div>
            <div>{game.secondsLeftInLevel} seconds remaining in level</div>
            { game.locationIndex + 1 <= gameDefinition.locations.length
              ? <button onClick={this.nextLocation}>{game.locationIndex < 0 ? 'Start Game!' : 'Skip'}</button>
              : <div>Game over.  Delete game to clear leaderboard and restart <button onClick={this.deleteGame}>Delete game</button></div>}
          </div>
        )
      case 'NEW':
      default:
        return <button onClick={this.open}>Open to Players</button>
    }
  }

  openBigScreen = (game) =>
    this.fbc.getLongLivedAdminToken().then(token =>
      openTab(`?page=bigScreen&game=${encodeURIComponent(game.definitionId)}&token=${encodeURIComponent(token)}`))

  // Allows players to join
  open = () => {
    const { game } = this.state
    game.state = 'OPEN'
    game.locationIndex = -1

    this.fbc.database.public.adminRef('games').child(game.definitionId).set(game)
    this.setState({game})
    const self = this

    if (self.openTimer) clearInterval(self.openTimers)
    self.openTimer = setInterval(() => {
      this.fbc.database.private.adminableUsersRef().once('value', data => {
        const guesses = guessesFromAdminableUsersData(data, game)
        self.addUnscoredPlayersAndUpdateGameScores(game, guesses, {})
      })
    }, 2000)
  }

  deleteGame = () =>  {
    const { game } = this.state
    this.fbc.database.public.adminRef('games').child(game.definitionId).remove()
    this.fbc.database.private.adminableUsersRef().once('value', data => {
      const usersObj = data.val() || {}
      Object.keys(usersObj).forEach(userId => {
        this.fbc.database.private.adminableUsersRef(userId).child('games').child(game.definitionId).child('guess').remove()
      })
    })
    this.fbc.database.private.adminRef('scores/games').child(game.definitionId).remove()

    this.newGame()
  }

  mapTimer = null
  nextLocation = () => {
    if (this.openTimer) {
      clearInterval(this.openTimer)
      delete this.openTimer
    }
    const self = this
    const { game, gameDefinition } = this.state

    game.locationIndex++
    if (game.locationIndex < gameDefinition.locations.length) game.showingMap = true
    this.setState({game})
    this.fbc.database.public.adminRef('games').child(game.definitionId).set(game)
      
    if (this.mapTimer) clearInterval(this.mapTimer)
    if (game.locationIndex < gameDefinition.locations.length) {
      doLevel(maxLevel)

      function doLevel(level) {
        game.level = level
        game.secondsLeftInLevel = levelSeconds
        self.setState({game})
        self.fbc.database.public.adminRef('games').child(game.definitionId).set(game)
        self.mapTimer = setInterval(() => {
          if (--game.secondsLeftInLevel <= 0) {
            clearInterval(self.mapTimer)
            // Read everyone's guesses
            self.fbc.database.private.adminableUsersRef().once('value', data => {
              const guesses = guessesFromAdminableUsersData(data, game)
              const scorer = proximityScorer(gameDefinition.locations[game.locationIndex])
              const levelScores = guesses.reduce((scoresByPlayer, guess) => {
                if (!guess.location) guess.location = {}
                const location = { lat: +guess.location.lat, lng: normalizeLng(+guess.location.lng) }
                const { user } = guess
                scoresByPlayer[guess.user.id] = { user, location, score: scorer(location) }
                return scoresByPlayer
              }, {})
              const locationIndex = game.locationIndex

              self.fbc.database.private.adminRef('scores/games').child(game.definitionId).push({locationIndex, level, levelScores})
              .then(() => {
                if (level > minLevel) {
                  doLevel(level - 1)
                } else {
                  game.showingMap = false
                  setTimeout(() => self.nextLocation(), endOfLocationPause)
                }
                self.updateGameScores()
              })
            })
          }
          self.setState({game})
          self.fbc.database.public.adminRef('games').child(game.definitionId).set(game)
        }, 1000)
      }
    }
  }

  updateGameScores() {
    const { game } = this.state
    this.fbc.database.private.adminRef('scores/games').child(game.definitionId).once('value', data => {
      const scoresObj = data.val() || {}
      const scores = Object.keys(scoresObj).map(key => scoresObj[key])
      const scoresByPlayer = scores.reduce((scoresByPlayer, levelScore) => {
        const { locationIndex, level, levelScores } = levelScore
        const levelsPerLocation = maxLevel - minLevel + 1
        Object.keys(levelScores || {})
          .map(userId => levelScores[userId])
          .filter(x => x.user && x.user.id)
          .forEach(userLevelScore => {
            const userLevelScores = scoresByPlayer[userLevelScore.user.id] = scoresByPlayer[userLevelScore.user.id] || { user: userLevelScore.user, scores: [] }
            const index = levelsPerLocation * locationIndex + maxLevel - level
            userLevelScores.scores[index] = userLevelScore.score
          })
        return scoresByPlayer
      }, {})

      this.fbc.database.private.adminRef('guesses/games').child(game.definitionId).once('value', data => {
        const guessesObj = data.val() || {}
        const guesses = Object.keys(guessesObj).map(key => guessesObj[key])
        this.addUnscoredPlayersAndUpdateGameScores(game, guesses, scoresByPlayer)        
      })
    })
  }

  addUnscoredPlayersAndUpdateGameScores(game, guesses, scoresByPlayer) {
    guesses.forEach(g => {
      if (g.user && g.user.id && !scoresByPlayer[g.user.id]) {
        scoresByPlayer[g.user.id] = { user: g.user, scores: [] }
      }
    })

    // Store cumulative scores at each level
    const playersAndScores = Object.keys(scoresByPlayer).map(userId => {
      const { user, scores } = scoresByPlayer[userId]
      return { user, scores }
    })
    playersAndScores.forEach(pas => {
      for (var i = 1; i < pas.scores.length; ++i) {
        pas.scores[i] = (pas.scores[i] || 0) + (pas.scores[i-1] || 0)
      }
      pas.score = pas.scores[pas.scores.length - 1] || 0
    })
    playersAndScores.sort((a, b) => b.score - a.score)
    game.playersAndScores = playersAndScores
    this.fbc.database.public.adminRef('games').child(game.definitionId).set(game)
  }

  componentWillUnmount() {
    if (this.mapTimer) clearInterval(this.mapTimer)
  }

  componentDidMount() {
    this.fbc = this.props.fbc
    this.gameDefinitionsRef = this.fbc.database.private.adminRef('gameDefinitions')
    
    this.gameDefinitionsRef.child(this.props.gameDefinition).once('value', data => {
      const gameDefinition = data.val()
      if (gameDefinition) {
        this.setState({gameDefinition})
        this.fbc.database.public.adminRef('games').child(data.key).once('value', data => {
          const game = data.val()
          if (game) {
            this.setState({game})
            if (game.state === 'OPEN' && game.locationIndex < 0) this.open()
          } else {
            this.newGame()
          }
        })
      }
    })
  }

  newGame() {
    const { gameDefinition } = this.state
    const game = {
      definitionId: gameDefinition.id,
      name: gameDefinition.name,
      state: 'NEW'
    }
    this.fbc.database.public.adminRef('games').child(gameDefinition.id).set(game)
    this.setState({game})
  }
}

function guessesFromAdminableUsersData(data, game) {
  const usersObj = data.val() || {}
  return Object.keys(usersObj)
    .map(userId => ({userId, u: usersObj[userId]}))
    .filter(x => x.u.games && x.u.games[game.definitionId] && x.u.games[game.definitionId].guess && x.u.games[game.definitionId].guess.user && x.u.games[game.definitionId].guess.user.id === x.userId)
    .map(x => x.u.games[game.definitionId].guess)
}

function radians(degrees) {
  return degrees * Math.PI / 180
}

function greatCircleDistance(source, dest) {
  const lat1 = source.lat
  const lat2 = dest.lat
  const lon1 = source.lng
  const lon2 = dest.lng
  ///const R = 6371e3 // meters
  const φ1 = radians(lat1)
  const φ2 = radians(lat2)
  const Δφ = radians(lat2-lat1)
  const Δλ = radians(lon2-lon1)

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ/2) * Math.sin(Δλ/2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

  //const d = R * c
  return c // return distance in radians
}

function proximityScorer(targetPoint) {
  return function proximityScore(point) {
    const linearScore = greatCircleDistance(point, targetPoint) / Math.PI
    return 100.0 * Math.max(0, Math.min(1, -Math.log(linearScore + 0.005)*0.2))
  }
}
