import React, { Component } from 'react'
import './App.css'

import { parseQueryString } from './utils'
import ConfigGames from './ConfigGames'
import PlayGame from './PlayGame'
import BigScreen from './BigScreen'

import client from '@doubledutch/admin-client'
import FirebaseConnector from '@doubledutch/firebase-connector'
const fbc = FirebaseConnector(client, 'whereintheworld')

fbc.initializeAppWithSimpleBackend()

export default class App extends Component {
  constructor() {
    super()
    this.state = {}
    const { token } = parseQueryString()
    if (token) client.longLivedToken = token
  }

  componentDidMount() {
    fbc.signinAdmin().then(() => this.setState({isSignedIn: true}))
  }

  render() {
    if (!this.state.isSignedIn) return <div>Loading...</div>
    const qs = parseQueryString()

    switch (qs.page) {
      case 'play':
        return <PlayGame fbc={fbc} gameDefinition={qs.gameDefinition} />
      case 'bigScreen':
        return <BigScreen fbc={fbc} game={qs.game} />
      default:
        return <ConfigGames fbc={fbc} />
    }
  }
}
