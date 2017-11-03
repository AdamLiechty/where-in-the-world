import React, { Component } from 'react'
import { Chart } from 'react-google-charts'
import { minLevel, maxLevel } from './constants'

export default class BigScreenScore extends Component {
  render() {
    const { game, gameDefinition } = this.props
    if (!game.playersAndScores) game.playersAndScores = []
    return (
      <div id="chart-and-scores">
        { game.state === 'NEW'
          ? <div>Waiting for game to open...</div>
          : game.level >= 0
            ? game.playersAndScores.length
              ? [<Chart
                key="chart"
                chartType="LineChart"
                data={this.chartData({ game, gameDefinition })}
                options={{
                  legend: {position: 'in'}
                }}
                graph_id="LineChart"
                width="75%"
                height="100%"
              />, this.renderPlayersScoreAndAvatar(game)]
              : <div>No players joined this game</div>
            : <div>Game not started.  Players: {this.renderPlayersScoreAndAvatar(game)}</div>    
        }
      </div>
    )
  }

  renderPlayersScoreAndAvatar(game) {
    return (
      <div key="players" id="avatar-scores">
        { game.playersAndScores.map(playerAndScore => {
          const imageUrl = userImage(playerAndScore)
          return (
            <div key={playerAndScore.user.id}>
              <span>{Math.floor(playerAndScore.score)}&nbsp;</span>
              { imageUrl && <div className="avatar"><img alt="avatar" src={imageUrl} /></div> }
              &nbsp;{getName(playerAndScore)}
            </div>
          )
        })}
      </div>
    )
  }

  chartData({ game, gameDefinition }) {
    const playerNames = (game.playersAndScores || []).map(getName)
    if (!playerNames.length || game.level < 0) return null
    const indexes = (maxLevel - minLevel + 1) * Math.min(game.locationIndex + 1, gameDefinition.locations.length)

    const data = [
      ['Question', ...playerNames],
      ...[...Array(indexes).keys()].map(i => [i, ...game.playersAndScores.map(pas => pas.scores[i] || 0)])
    ]
    return data
  }
}

function getName(playerAndScore) {
  const u = playerAndScore.user
  return u.firstName ? `${u.firstName} ${u.lastName}` : u.email
}

function userImage(playerAndScore) {
  return playerAndScore.user && playerAndScore.user.image
}
