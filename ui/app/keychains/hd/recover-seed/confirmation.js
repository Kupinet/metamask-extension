const inherits = require('util').inherits
const Component = require('react').Component
const PropTypes = require('prop-types')
const connect = require('react-redux').connect
const h = require('react-hyperscript')
const actions = require('../../../actions')
const { withRouter } = require('react-router-dom')
const { compose } = require('recompose')
const {
  DEFAULT_ROUTE,
  INITIALIZE_BACKUP_PHRASE_ROUTE,
} = require('../../../routes')

RevealSeedConfirmation.contextTypes = {
  t: PropTypes.func,
}

module.exports = compose(
  withRouter,
  connect(mapStateToProps)
)(RevealSeedConfirmation)


inherits(RevealSeedConfirmation, Component)
function RevealSeedConfirmation () {
  Component.call(this)
}

function mapStateToProps (state) {
  return {
    warning: state.appState.warning,
  }
}

RevealSeedConfirmation.prototype.render = function () {
  const props = this.props

  return (

    h('.initialize-screen.flex-column.flex-center.flex-grow', {
      style: { maxWidth: '420px' },
    }, [

      h('h3.flex-center.text-transform-uppercase', {
        style: {
          background: '#EBEBEB',
          color: '#AEAEAE',
          marginBottom: 24,
          width: '100%',
          fontSize: '20px',
          padding: 6,
        },
      }, [
        'Reveal Seed Words',
      ]),

      h('.div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          justifyContent: 'center',
        },
      }, [

        h('h4', this.context.t('revealSeedWordsWarning')),

        // confirmation
        h('input.large-input.letter-spacey', {
          type: 'password',
          id: 'password-box',
          placeholder: this.context.t('enterPasswordConfirm'),
          onKeyPress: this.checkConfirmation.bind(this),
          style: {
            width: 260,
            marginTop: '12px',
          },
        }),

        h('.flex-row.flex-start', {
          style: {
            marginTop: 30,
            width: '50%',
          },
        }, [
          // cancel
          h('button.primary', {
            onClick: this.goHome.bind(this),
          }, 'CANCEL'),

          // submit
          h('button.primary', {
            style: { marginLeft: '10px' },
            onClick: this.revealSeedWords.bind(this),
          }, 'OK'),

        ]),

        (props.warning) && (
          h('span.error', {
            style: {
              margin: '20px',
            },
          }, props.warning.split('-'))
        ),

        props.inProgress && (
          h('span.in-progress-notification', this.context.t('generatingSeed'))
        ),
      ]),
    ])
  )
}

RevealSeedConfirmation.prototype.componentDidMount = function () {
  document.getElementById('password-box').focus()
}

RevealSeedConfirmation.prototype.goHome = function () {
  this.props.dispatch(actions.showConfigPage(false))
  this.props.dispatch(actions.confirmSeedWords())
    .then(() => this.props.history.push(DEFAULT_ROUTE))
}

// create vault

RevealSeedConfirmation.prototype.checkConfirmation = function (event) {
  if (event.key === 'Enter') {
    event.preventDefault()
    this.revealSeedWords()
  }
}

RevealSeedConfirmation.prototype.revealSeedWords = function () {
  var password = document.getElementById('password-box').value
  this.props.dispatch(actions.requestRevealSeed(password))
    .then(() => this.props.history.push(INITIALIZE_BACKUP_PHRASE_ROUTE))
}
