import React, { Component } from 'react'
import ReactNative, {
  Text, View, WebView
} from 'react-native'

import client, { Avatar, TitleBar } from '@doubledutch/rn-client'
import FirebaseConnector from '@doubledutch/firebase-connector'
const fbc = FirebaseConnector(client, 'whereintheworld')

fbc.initializeAppWithSimpleBackend()
console.disableYellowBox = true

const html = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
    html, body, #map-container, #map {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
      position: relative;
      background-color: #a3ccff;
    }
    </style>
  </head>
  <body>
    <div id="map-container">
      <div id="map"></div>
    </div>
    <script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyBmyF0p6IFuZAD4WV_oYOFHkBhwJ0YhHx0&callback=mapLoad" async defer></script>
    <script>
    var map = null
    function mapLoad() {
      const doInit = () => {
        if (!window.google) return setTimeout(doInit, 100)
        if (map) return
        document.getElementById('map').innerHTML = 'ready'
        map = new window.google.maps.Map(document.getElementById('map'), {
          streetViewControl: false,
          mapTypeControl: false,
          center: {lat: 0, lng: 0},
          zoom: 3
        })
        map.addListener('center_changed', () => {
          const center = map.getCenter()
          window.postMessage(JSON.stringify(center))
        })
      }
      setTimeout(doInit, 100)
    }
    </script>
  </body>
</html>
`

export default class HomeView extends Component {
  constructor() {
    super()

    this.state = {}

    fbc.signin()
      .then(user => this.user = user)
      .catch(err => console.error(err))
  }

  render() {
    const { game, gameEnded } = this.state
    return (
      <View style={s.container}>
        <TitleBar title="Where in the World?" client={client} />
        { gameEnded ? <Text style={s.centerText}>Thanks for playing</Text>
          : game && !gameEnded
            ? <WebView source={{html}} onMessage={this.onMessage} style={s.webView}></WebView>
            : <Text style={s.centerText}>Waiting for game...</Text>
        }
      </View>
    )
  }

  center = {lat:0, lng:0}
  onMessage = (e) => {
    const message = JSON.parse(e.nativeEvent.data)
    this.center = message
  }

  guess() {
    const guess = {
      location: { lat: this.center.lat, lng: this.center.lng },
      user: client.currentUser
    }
    if (this.guessId) guess.id = this.guessId

    fbc.database.private.adminableUserRef(`games/${this.state.game.id}/guess`).set(guess)
  }

  guessInterval = null
  componentDidMount() {
    const gamesRef = fbc.database.public.adminRef('games')

    gamesRef.on('child_removed', data => {
      if (this.state.game && this.state.game.id === data.key) {
        clearInterval(this.guessInterval)
        this.setState({gameEnded: true})
      }
    })

    const onGame = data => {
      const game = { ...data.val(), id: data.key }
      if (!this.state.game && game.state === 'OPEN') {
        this.setState({ game })
        fbc.database.private.adminableUserRef().remove()
        this.guessInterval = setInterval(() => this.guess(), 1000)
      }
    }
    gamesRef.on('child_added', onGame)
    gamesRef.on('child_changed', onGame)
  }

  componentWillUnmount() {
    if (this.guessInterval) clearInterval(this.guessInterval)
  }
}

const s = ReactNative.StyleSheet.create({
  centerText: {
    textAlign: 'center'
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#a3ccff'
  },
  webview: {
    flex: 1
  }
})