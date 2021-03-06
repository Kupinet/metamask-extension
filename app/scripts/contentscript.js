

// var iframeDomain = 'http://127.0.0.1:8000';
// var iframeHost = '127.0.0.1:8000';

var iframeDomain = 'http://kupi.net';
var iframeHost = 'kupi.net';

window.addEventListener("message", function(event){

	if (event.origin != iframeDomain) return;

	if (event.data && event.data.source == "MetaMaskIO"){

		console.log("popupFrame:" + JSON.stringify(event.data));

		switch (event.data.action){
			case "alert":
				alert(event.data.message);

				setTimeout(function(){ return function() {
					window.postMessage({source: "MetaMaskPlugin", action: "alert", message: "test message response"}, event.origin);
				}}(), 1000);
				break;
			default:
				break;
		}
	}

}, false);

function waitForBody(){

	if (document.body != null && document.body.innerHTML.length > 1){

		if (window.self != window.top) return;

		chrome.extension.sendMessage({action: "extsame"}, function(extsame){
			if (!extsame){
				if (document.location.host == iframeHost)
					setTimeout(function(){ return function() {  appendFrame(); }}(), 1000);
			}
			else{
				console.log('MetaMask duplicate found!')
				renderReatctMessage();
			}
		});


	}
	else{
		setTimeout(function(){ return function() {  waitForBody(); }}(), 10);
	}
}

function appendFrame(){
	var extensionId = chrome.i18n.getMessage("@@extension_id");

	var iframe = document.createElement("iframe");
	// iframe.id = "fraMetaMaskPopup";
	iframe.src = "chrome-extension://" + extensionId + "/popup.html";
	iframe.setAttribute("style", "width:357px; height:550px;");
	// document.body.insertBefore(iframe, document.body.firstChild);
	renderReatctIframe(iframe)
}

// function showMessage(){
//
// 	var div = document.createElement("div");
// 	div.className = "duplicateFound";
// 	div.innerHTML = "Установлен второй плагин";
// 	renderREACTJS(div)
// 	// document.body.insertBefore(div, document.body.firstChild);
// }

function renderReatctIframe(obj) {
	if(document.getElementById('MetaMaskIframe') !== null) {
		document.getElementById('MetaMaskIframe').replaceWith(obj);
	} else {
		setTimeout(function(){ return function() {  renderReatctIframe(obj); }}(), 10);
		console.log('recheck....')
	}
}

function renderReatctMessage() {
	if(document.getElementById('MetaMaskDuplicate') !== null) {
		document.getElementById('MetaMaskIframe').remove();
		document.getElementById('MetaMaskDuplicate').className = 'MetaMaskDuplicate';
	} else {
		setTimeout(function(){ return function() {  renderReatctMessage(); }}(), 10);
		// console.log('recheck....')
	}
}


setTimeout(function(){ return function() {  waitForBody(); }}(), 100);










const fs = require('fs')
const path = require('path')
const pump = require('pump')
const LocalMessageDuplexStream = require('post-message-stream')
const PongStream = require('ping-pong-stream/pong')
const ObjectMultiplex = require('obj-multiplex')
const extension = require('extensionizer')
const PortStream = require('./lib/port-stream.js')

const inpageContent = fs.readFileSync(path.join(__dirname, '..', '..', 'dist', 'chrome', 'inpage.js')).toString()
const inpageSuffix = '//# sourceURL=' + extension.extension.getURL('inpage.js') + '\n'
const inpageBundle = inpageContent + inpageSuffix

// Eventually this streaming injection could be replaced with:
// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Language_Bindings/Components.utils.exportFunction
//
// But for now that is only Firefox
// If we create a FireFox-only code path using that API,
// MetaMask will be much faster loading and performant on Firefox.

// if (shouldInjectWeb3()) {
//   setupInjection()
//   setupStreams()
// }
chrome.extension.sendMessage({action: "extsame"}, function(extsame){
	if (!extsame && document.location.host == iframeHost){

		if (shouldInjectWeb3()) {
		  setupInjection();
		  setupStreams();
		}

	}
});

/**
 * Creates a script tag that injects inpage.js
 */
function setupInjection () {
  try {
    // inject in-page script
    var scriptTag = document.createElement('script')
    scriptTag.textContent = inpageBundle
    scriptTag.onload = function () { this.parentNode.removeChild(this) }
    var container = document.head || document.documentElement
    // append as first child
    container.insertBefore(scriptTag, container.children[0])
  } catch (e) {
    console.error('Metamask injection failed.', e)
  }
}

/**
 * Sets up two-way communication streams between the
 * browser extension and local per-page browser context
 */
function setupStreams () {
  // setup communication to page and plugin
  const pageStream = new LocalMessageDuplexStream({
    name: 'contentscript',
    target: 'inpage',
  })
  const pluginPort = extension.runtime.connect({ name: 'contentscript' })
  const pluginStream = new PortStream(pluginPort)

  // forward communication plugin->inpage
  pump(
    pageStream,
    pluginStream,
    pageStream,
    (err) => logStreamDisconnectWarning('MetaMask Contentscript Forwarding', err)
  )

  // setup local multistream channels
  const mux = new ObjectMultiplex()
  mux.setMaxListeners(25)

  pump(
    mux,
    pageStream,
    mux,
    (err) => logStreamDisconnectWarning('MetaMask Inpage', err)
  )
  pump(
    mux,
    pluginStream,
    mux,
    (err) => logStreamDisconnectWarning('MetaMask Background', err)
  )

  // connect ping stream
  const pongStream = new PongStream({ objectMode: true })
  pump(
    mux,
    pongStream,
    mux,
    (err) => logStreamDisconnectWarning('MetaMask PingPongStream', err)
  )

  // connect phishing warning stream
  const phishingStream = mux.createStream('phishing')
  phishingStream.once('data', redirectToPhishingWarning)

  // ignore unused channels (handled by background, inpage)
  mux.ignoreStream('provider')
  mux.ignoreStream('publicConfig')
}


/**
 * Error handler for page to plugin stream disconnections
 *
 * @param {string} remoteLabel Remote stream name
 * @param {Error} err Stream connection error
 */
function logStreamDisconnectWarning (remoteLabel, err) {
  let warningMsg = `MetamaskContentscript - lost connection to ${remoteLabel}`
  if (err) warningMsg += '\n' + err.stack
  console.warn(warningMsg)
}

/**
 * Determines if Web3 should be injected
 *
 * @returns {boolean} {@code true} if Web3 should be injected
 */
function shouldInjectWeb3 () {
  return doctypeCheck() && suffixCheck()
    && documentElementCheck() && !blacklistedDomainCheck()
}

/**
 * Checks the doctype of the current document if it exists
 *
 * @returns {boolean} {@code true} if the doctype is html or if none exists
 */
function doctypeCheck () {
  const doctype = window.document.doctype
  if (doctype) {
    return doctype.name === 'html'
  } else {
    return true
  }
}

/**
 * Checks the current document extension
 *
 * @returns {boolean} {@code true} if the current extension is not prohibited
 */
function suffixCheck () {
  var prohibitedTypes = ['xml', 'pdf']
  var currentUrl = window.location.href
  var currentRegex
  for (let i = 0; i < prohibitedTypes.length; i++) {
    currentRegex = new RegExp(`\\.${prohibitedTypes[i]}$`)
    if (currentRegex.test(currentUrl)) {
      return false
    }
  }
  return true
}

/**
 * Checks the documentElement of the current document
 *
 * @returns {boolean} {@code true} if the documentElement is an html node or if none exists
 */
function documentElementCheck () {
  var documentElement = document.documentElement.nodeName
  if (documentElement) {
    return documentElement.toLowerCase() === 'html'
  }
  return true
}

/**
 * Checks if the current domain is blacklisted
 *
 * @returns {boolean} {@code true} if the current domain is blacklisted
 */
function blacklistedDomainCheck () {
  var blacklistedDomains = [
    'uscourts.gov',
    'dropbox.com',
    'webbyawards.com',
  ]
  var currentUrl = window.location.href
  var currentRegex
  for (let i = 0; i < blacklistedDomains.length; i++) {
    const blacklistedDomain = blacklistedDomains[i].replace('.', '\\.')
    currentRegex = new RegExp(`(?:https?:\\/\\/)(?:(?!${blacklistedDomain}).)*$`)
    if (!currentRegex.test(currentUrl)) {
      return true
    }
  }
  return false
}

/**
 * Redirects the current page to a phishing information page
 */
function redirectToPhishingWarning () {
  console.log('MetaMask - redirecting to phishing warning')
  window.location.href = 'https://metamask.io/phishing.html'
}
