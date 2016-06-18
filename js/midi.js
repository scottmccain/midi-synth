var selectMIDI = null;
var midiAccess = null;
var midiOut = null;

function selectMIDIOut(ev) {
  var id = ev.target[ev.target.selectedIndex].value;
  if ((typeof(midiAccess.outputs) == "function"))   //Old Skool MIDI inputs() code
    midiOut = midiAccess.outputs()[ev.target.selectedIndex];
  else
    midiOut = midiAccess.outputs.get(id);
}


function populateMIDIOutSelect() {
  // clear the MIDI input select
  selectOutMIDI.options.length = 0;
  if (midiOut && midiOut.state=="disconnected")
    midiOut=null;
  var firstOutput = null;

  var outputs=midiAccess.outputs.values();
  for ( var output = outputs.next(); output && !output.done; output = outputs.next()){
    output = output.value;
    if (!firstOutput)
      firstOutput=output;
    var str=output.name.toString();
    var preferred = !midiOut && ((str.indexOf("MPK") != -1)||(str.indexOf("Keyboard") != -1)||(str.indexOf("keyboard") != -1)||(str.indexOf("KEYBOARD") != -1));

    // if we're rebuilding the list, but we already had this port open, reselect it.
    if (midiOut && midiOut==output)
      preferred = true;

    selectOutMIDI.appendChild(new Option(output.name,output.id,preferred,preferred));
    if (preferred) {
      midiOut = output;
    }
  }
  if (!midiOut) {
      midiOut = firstOutput;
  }
}



function midiConnectionStateChange( e ) {
  console.log("connection: " + e.port.name + " " + e.port.connection + " " + e.port.state );
  populateMIDIOutSelect();
}

function onMIDIStarted( midi ) {
  var preferredIndex = 0;

  midiAccess = midi;

  document.getElementById("synthbox").className = "loaded";
  selectOutMIDI=document.getElementById("midiOut");
  midi.onstatechange = midiConnectionStateChange;
  populateMIDIOutSelect();
  selectOutMIDI.onchange = selectMIDIOut;
}

function onMIDISystemError( err ) {
  document.getElementById("synthbox").className = "error";
  console.log( "MIDI not initialized - error encountered:" + err.code );
}

//init: start up MIDI
window.addEventListener('load', function() {   
  if (navigator.requestMIDIAccess)
    navigator.requestMIDIAccess().then( onMIDIStarted, onMIDISystemError );

});