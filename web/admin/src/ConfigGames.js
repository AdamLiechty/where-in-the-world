import React, { Component } from 'react'
import { normalizeLng, openTab } from './utils'
import './ConfigGames.css'

export default class ConfigGames extends Component {
  constructor() {
    super()
    this.state = {
      gameDefinitions: [],
      newGameName: '',
      selectedLocation: {game: {}, index: -1}
    }
  }

  render() {
    return (
      <div>
        <div id="outline">
          <h1>Game definitions</h1>
          { this.state.gameDefinitions ?
              this.state.gameDefinitions.map(gd => (
                <div key={gd.id}>
                  <div>{gd.name} <button onClick={() => this.playGame(gd)}>Play</button> ••• <button onClick={() => this.deleteGame(gd)}>Delete</button></div>
                  <ol>
                    { gd.locations.map((loc, index) => (
                      <li key={index}>
                        <span>({loc.lat}, {loc.lng})</span>&nbsp;
                        <input type="radio" value={[gd.id,index].join('.')}
                          onChange={() => this.selectLocation(gd, index)}
                          checked={this.state.selectedLocation.game.id === gd.id && this.state.selectedLocation.index === index} name="location" />&nbsp;
                        <button onClick={() => this.deleteLocation(gd, index)}>Delete</button>
                      </li>
                    )) }
                    <button onClick={() => this.addNewLocation(gd)}>Add new location</button>
                  </ol>
                </div>
              ))
            : <div>Loading...</div>
          }
          <div>
            <input type="text" value={this.state.newGameName} onChange={this.updateNewGameName} placeholder="name" />
            <button onClick={this.addNewGame}>Add new game</button>
          </div>
        </div>
        <div id="map"></div>
      </div>
    )
  }

  playGame = (game) =>
    this.fbc.getLongLivedAdminToken().then(token =>
      openTab(`?page=play&gameDefinition=${encodeURIComponent(game.id)}&token=${encodeURIComponent(token)}`))

  initMap() {
    const doInit = () => {
      if (!window.google) return setTimeout(doInit, 100)
      if (this.map) return
      const map = this.map = new window.google.maps.Map(document.getElementById('map'), {
        center: {lat: 0, lng: 0},
        zoom: 6,
        mapTypeId: 'satellite'
      })
      map.addListener('center_changed', () => {
        const center = map.getCenter()
        const location = {lat:center.lat(), lng:normalizeLng(center.lng())}
        this.updateLocation(location)
      })
    }
    setTimeout(doInit, 100)
  }

  selectLocation(game, index) {
    this.setState({selectedLocation: {game, index}})
    const location = game.locations[index]
    if (location) setTimeout(() => this.map.setCenter(location), 101)
  }

  updateLocation(location) {
    const {game, index} = this.state.selectedLocation
    if (game.locations && index >= 0) {
      game.locations.splice(index, 1, location) // Replace location
      this.gameDefinitionsRef.child(game.id).set(game)
    }
  }

  addNewLocation(game) {
    game.locations.push({lat:0, lng: 0})
    this.gameDefinitionsRef.child(game.id).set(game)
  }

  updateNewGameName = (evt) => {
    this.setState({ newGameName: evt.target.value })
  }

  deleteGame(game) {
    this.gameDefinitionsRef.child(game.id).remove()
  }

  deleteLocation(game, index) {
    game.locations.splice(index, 1)
    this.gameDefinitionsRef.child(game.id).set(game)
  }

  addNewGame = () => {
    const name = this.state.newGameName
    const gameDef = { name }
    this.gameDefinitionsRef.push(gameDef)
    .then(() => this.setState({newGameName: ''}))
  }

  componentDidMount() {
    this.fbc = this.props.fbc
    this.gameDefinitionsRef = this.fbc.database.private.adminRef('gameDefinitions')

    this.initMap()
    
    this.gameDefinitionsRef.on('value', data => {
      const gameDefinitionsObj = data.val()
      if (!gameDefinitionsObj) return
      const gameDefinitions = Object.keys(gameDefinitionsObj)
        .map(id => ({...gameDefinitionsObj[id], id}))
        .map(gd => gd.locations ? gd : {...gd, locations: []})
        .sort((m1, m2) => m1.name < m2.name ? -1 : 1)
      this.setState({ gameDefinitions })
      if (this.state.selectedLocation.index < 0 && gameDefinitions.length) {
        this.selectLocation(gameDefinitions[0], 0)
      }

      const validDefinitionIds = gameDefinitions.map(d => d.id)
      const gamesByDefinitionRef = this.fbc.database.public.adminRef('games')
      gamesByDefinitionRef.once('value', data => {
        const defKeys = Object.keys(data.val() || {})
        defKeys.filter(defKey => !validDefinitionIds.includes(defKey)).forEach(defKey => gamesByDefinitionRef.child(defKey).remove())
      })
    })
  }
}
