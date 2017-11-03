import React, { Component } from 'react'
import ReactCSSTransitionGroup from 'react-addons-css-transition-group'
import BigScreenScore from './BigScreenScore'
import { maxLevel } from './constants'

import './BigScreen.css'

export default class BigScreen extends Component {
  constructor() {
    super()
    this.state = { }
  }
  render() {
    const { gameDefinition, game } = this.state

    return (
      <div>
        { gameDefinition && game
          ? <div id="big-map"></div>
          : <div>Loading...</div> }
        <ReactCSSTransitionGroup transitionName="big-score" transitionEnterTimeout={1000} transitionLeaveTimeout={250}>
        { gameDefinition && game && !game.showingMap && <div key="big-score-key" id="big-score">
          <BigScreenScore game={game} gameDefinition={gameDefinition} />
        </div> }
        </ReactCSSTransitionGroup>
      </div>
    )
  }

  componentWillMount() {
    this.fbc = this.props.fbc

    this.fbc.database.private.adminRef('gameDefinitions').child(this.props.game).once('value', data => {
      const gameDefinition = data.val()
      if (gameDefinition) {
        this.setState({gameDefinition})
      }

      this.fbc.database.public.adminRef('games').child(this.props.game).on('value', data => {
        const game = data.val()
        if (game) {
          const alreadyShowingMap = (this.state.game || {}).showingMap
          this.setState({ game })
          const center = gameDefinition.locations[game.locationIndex]
          const { level } = game
          if (!alreadyShowingMap && game.showingMap) this.initMap(center, level || maxLevel)
          if (this.map && game.showingMap) {
            this.map.setCenter(center)
            this.map.setZoom(game.level)
          }
        }
      })
    })
  }

  initMap(center, zoom) {
    const self = this
    const doInit = () => {
      const mapDiv = document.getElementById('big-map')
      if (!window.google || !mapDiv) return setTimeout(doInit, 100)
      if (self.map) return
      self.map = new window.google.maps.Map(mapDiv, {
        streetViewControl: false,
        mapTypeControl: false,
        zoomControl: false,
        draggable: false,
        scrollWheel: false,
        center,
        zoom,
        mapTypeId: 'satellite'
      })
    }
    setTimeout(doInit, 100)
  }
}
