#!/usr/bin/env node
var os = require('os')
var fs = require('fs')
var path = require('path')
var https = require('https')
var cheerio = require('cheerio')
var progress = require('progress')
var concat = require('concat-stream')

var url = 'https://www.packer.io/downloads.html'
var archPacker = { 'x64': 'amd64', 'ia32': '386', 'arm': 'arm' }
var platform = os.platform() // 'darwin', 'freebsd', 'linux', 'sunos', 'win32'
var arch = os.arch() // 'x64', 'arm' and 'ia32'

console.log('* Fetching download links from:\n  ' + url)
streamRequest(url, downloadLinks)

function downloadLinks (error, response) {
  if (error) return console.log(error)
  response.pipe(concat(page => getDownloadLink(page, downloadPacker)))
}

function downloadPacker (error, link) {
  if (error) return console.log(error)
  console.log('* Chosen download link for current system:\n  ' + link)
  var filename = path.basename(link)
  var file = fs.createWriteStream(filename)
  file.on('finish', close)
  file.on('error', handleError)
  console.log('* Download and save packer.io to: ./' + filename)
  streamRequest(link, function (error, response) {
    if (error) return console.error(error.message)
    response.pipe(file)
  })
  function close () { file.close() }
  function handleError (error) {
    fs.unlink(filename) // Delete the file async without checking result
    return console.error(error.message)
  }
}

function getDownloadLink (page, cb) {
  var link = [].slice.call(cheerio.load(page)('.container .download a'))
    .map(x => x.attribs.href)
    .filter(x => ~x.indexOf(platform))
    .filter(x => ~x.indexOf(archPacker[arch])).shift()
  cb(null, link)
}

function streamRequest (url, cb) {
  var callback = cb || function noop () {}
  var request = https.get(url)
  request.on('error', callback)
  request.on('response', handleResponse)
  // request.setTimeout(12000, function () { request.abort() })
  function handleResponse (response) {
    if (response.statusCode !== 200) {
      return cb('Response status was ' + response.statusCode);
    }
    response.on('data', function (chunk) { bar.tick(chunk.length) })
    var len = parseInt(response.headers['content-length'], 10)
    var bar = new progress('  downloading [:bar] :percent :etas', {
      complete: '=',
      incomplete: ' ',
      width: 20,
      total: len
    })
    callback(null, response)
  }
}
