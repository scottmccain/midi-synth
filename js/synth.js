var voices = new Array();
var audioContext = null;
var isMobile = false;	// we have to disable the convolver on mobile for performance reasons.

// This is the "initial patch"
var currentModWaveform = 0;	// SINE
var currentModFrequency = 2.1; // Hz * 10 = 2.1
var currentModOsc1 = 15;
var currentModOsc2 = 17;

var currentOsc1Waveform = 2; // SAW
var currentOsc1Octave = 0;  // 32'
var currentOsc1Detune = 0;	// 0
var currentOsc1Mix = 50.0;	// 50%

var currentOsc2Waveform = 2; // SAW
var currentOsc2Octave = 0;  // 16'
var currentOsc2Detune = -25;	// fat detune makes pretty analogue-y sound.  :)
var currentOsc2Mix = 50.0;	// 0%

var currentFilterCutoff = 8;
var currentFilterQ = 7.0;
var currentFilterMod = 21;
var currentFilterEnv = 56;

var currentEnvA = 2;
var currentEnvD = 15;
var currentEnvS = 68;
var currentEnvR = 5;

var currentFilterEnvA = 5;
var currentFilterEnvD = 6;
var currentFilterEnvS = 5;
var currentFilterEnvR = 7;

var currentDrive = 38;
var currentRev = 32;
var currentVol = 75;


var currentOctave = 3;
var modOscFreqMultiplier = 1;
var moDouble = false;
var moQuadruple = false;

// end initial patch

var keys = new Array( 256 );
/* old mapping
keys[65] = 60; // = C4 ("middle C")
keys[87] = 61;
keys[83] = 62;
keys[69] = 63;
keys[68] = 64;
keys[70] = 65; // = F4
keys[84] = 66;
keys[71] = 67;
keys[89] = 68;
keys[72] = 69;
keys[85] = 70;
keys[74] = 71;
keys[75] = 72; // = C5
keys[79] = 73;
keys[76] = 74;
keys[80] = 75;
keys[186] = 76;
keys[222] = 77; // = F5
keys[221] = 78;
keys[13] = 79;
keys[220] = 80;
*/

//Lower row: zsxdcvgbhnjm...
keys[16] = 41; // = F2
keys[65] = 42;
keys[90] = 43;
keys[83] = 44;
keys[88] = 45;
keys[68] = 46;
keys[67] = 47;
keys[86] = 48; // = C3
keys[71] = 49;
keys[66] = 50;
keys[72] = 51;
keys[78] = 52;
keys[77] = 53; // = F3
keys[75] = 54;
keys[188] = 55;
keys[76] = 56;
keys[190] = 57;
keys[186] = 58;
keys[191] = 59;

// Upper row: q2w3er5t6y7u...
keys[81] = 60; // = C4 ("middle C")
keys[50] = 61;
keys[87] = 62;
keys[51] = 63;
keys[69] = 64;
keys[82] = 65; // = F4
keys[53] = 66;
keys[84] = 67;
keys[54] = 68;
keys[89] = 69;
keys[55] = 70;
keys[85] = 71;
keys[73] = 72; // = C5
keys[57] = 73;
keys[79] = 74;
keys[48] = 75;
keys[80] = 76;
keys[219] = 77; // = F5
keys[187] = 78;
keys[221] = 79;
keys[220] = 80;

var effectChain = null;
var waveshaper = null;
var volNode = null;
var revNode = null;
var revGain = null;
var revBypassGain = null;
var compressor = null;

function frequencyFromNoteNumber( note ) {
	return 440 * Math.pow(2,(note-69)/12);
}

function noteOn( note, velocity ) {
	console.log("note on: " + note );
	
	if(midiOut) {
		console.log('sending note on: ', note, velocity);
		midiOut.send( [ 0x90, note, 100 * velocity ] );
	}
	
	var e = document.getElementById( "k" + note );
	if (e)
		e.classList.add("pressed");	
}

function noteOff( note ) {
	
	if(midiOut) {
		midiOut.send( new Uint8Array( [ 0x80, note, 0x00 ] ) );
		console.log('midiout here');
	}
	
	var e = document.getElementById( "k" + note );
	if (e)
		e.classList.remove("pressed");
	
	
}

function $(id) {
	return document.getElementById(id);
}

// 'value' is normalized to 0..1.
function controller( number, value ) {
	switch(number) {
	case 2:
		$("fFreq").setRatioValue(value);
		onUpdateFilterCutoff( 100*value );
		return;
	case 0x0a:
	case 7:
		$("fQ").setValue(20*value);
		onUpdateFilterQ( 20*value );
		return;
	case 1:
		$("fMod").setValue(100*value);
		onUpdateFilterMod(100*value);	
		return;
	case 0x49:
	case 5:
	case 15:
	    $("drive").setValue(100 * value);
	    onUpdateDrive( 100 * value );
	    return;
	case 0x48:
	case 6:
	case 16:
	    $("reverb").setValue(100 * value);
	    onUpdateReverb( 100 * value );
	    return;
	case 0x4a:
	    $("modOsc1").setValue(100 * value);
	    onUpdateModOsc1( 100 * value );
	    return;
	case 0x47:
	    $("modOsc2").setValue(100 * value);
	    onUpdateModOsc2( 100 * value );
	    return;
	case 4:
	case 17:
	    $("mFreq").setValue(10 * value);
	    onUpdateModFrequency( 10 * value );
	    return;
	case 0x5b:
	    $("volume").setValue(100 * value);
	    onUpdateVolume( 100 * value );
	    return;
	case 33: // "x1" button
	case 51:
		moDouble = (value > 0);
		changeModMultiplier();
	    return;
	case 34: // "x2" button
	case 52:
		moQuadruple = (value > 0);
		changeModMultiplier();
	    return;
	}
}

var currentPitchWheel = 0.0;
// 'value' is normalized to [-1,1]
function pitchWheel( value ) {
	var i;

	currentPitchWheel = value;
	for (var i=0; i<255; i++) {
		if (voices[i]) {
			if (voices[i].osc1)
				voices[i].osc1.detune.value = currentOsc1Detune + currentPitchWheel * 500;	// value in cents - detune major fifth.
			if (voices[i].osc2)
				voices[i].osc2.detune.value = currentOsc2Detune + currentPitchWheel * 500;	// value in cents - detune major fifth.
		}
	}
}

function polyPressure( noteNumber, value ) {
	if (voices[noteNumber] != null) {
		voices[noteNumber].setFilterQ( value*20 );
	}
}

var waveforms = ["sine","square","sawtooth","triangle"];

function onUpdateModWaveform( ev ) {
	currentModWaveform = ev.target.selectedIndex;
	for (var i=0; i<255; i++) {
		if (voices[i] != null) {
			voices[i].setModWaveform( waveforms[currentModWaveform] );
		}
	}
}

function onUpdateModFrequency( ev ) {
	var value = ev.currentTarget ? ev.currentTarget.value : ev;
	currentModFrequency = value;
	var oscFreq = currentModFrequency * modOscFreqMultiplier;
	for (var i=0; i<255; i++) {
		if (voices[i] != null) {
			voices[i].updateModFrequency( oscFreq );
		}
	}
}

function onUpdateModOsc1( ev ) {
	var value = ev.currentTarget ? ev.currentTarget.value : ev;
	currentModOsc1 = value;
	for (var i=0; i<255; i++) {
		if (voices[i] != null) {
			voices[i].updateModOsc1( currentModOsc1 );
		}
	}
}

function onUpdateModOsc2( ev ) {
	var value = ev.currentTarget ? ev.currentTarget.value : ev;
	currentModOsc2 = value;
	for (var i=0; i<255; i++) {
		if (voices[i] != null) {
			voices[i].updateModOsc2( currentModOsc2 );
		}
	}
}

function onUpdateFilterCutoff( ev ) {
	var value = ev.currentTarget ? ev.currentTarget.value : ev;
//	console.log( "currentFilterCutoff= " + currentFilterCutoff + "new cutoff= " + value );
	currentFilterCutoff = value;
	for (var i=0; i<255; i++) {
		if (voices[i] != null) {
			voices[i].setFilterCutoff( value );
		}
	}
}

function onUpdateFilterQ( ev ) {
	var value = ev.currentTarget ? ev.currentTarget.value : ev;
	currentFilterQ = value;
	for (var i=0; i<255; i++) {
		if (voices[i] != null) {
			voices[i].setFilterQ( value );
		}
	}
}

function onUpdateFilterMod( ev ) {
	var value = ev.currentTarget ? ev.currentTarget.value : ev;
	currentFilterMod = value;
	for (var i=0; i<255; i++) {
		if (voices[i] != null) {
			voices[i].setFilterMod( value );
		}
	}
}

function onUpdateFilterEnv( ev ) {
	var value = ev.currentTarget ? ev.currentTarget.value : ev;
	currentFilterEnv = value;
}

function onUpdateOsc1Wave( ev ) {
	currentOsc1Waveform = ev.target.selectedIndex;
	for (var i=0; i<255; i++) {
		if (voices[i] != null) {
			voices[i].setOsc1Waveform( waveforms[currentOsc1Waveform] );
		}
	}
}

function onUpdateOsc1Octave( ev ) {
	currentOsc1Octave = ev.target.selectedIndex;
	for (var i=0; i<255; i++) {
		if (voices[i] != null) {
			voices[i].updateOsc1Frequency();
		}
	}
}

function onUpdateOsc1Detune( ev ) {
	var value = ev.currentTarget.value;
	currentOsc1Detune = value;
	for (var i=0; i<255; i++) {
		if (voices[i] != null) {
			voices[i].updateOsc1Frequency();
		}
	}
}

function onUpdateOsc1Mix( value ) {
	if (value.currentTarget)
		value = value.currentTarget.value;
	currentOsc1Mix = value;
	for (var i=0; i<255; i++) {
		if (voices[i] != null) {
			voices[i].updateOsc1Mix( value );
		}
	}
}

function onUpdateOsc2Wave( ev ) {
	currentOsc2Waveform = ev.target.selectedIndex;
	for (var i=0; i<255; i++) {
		if (voices[i] != null) {
			voices[i].setOsc2Waveform( waveforms[currentOsc2Waveform] );
		}
	}
}

function onUpdateOsc2Octave( ev ) {
	currentOsc2Octave = ev.target.selectedIndex;
	for (var i=0; i<255; i++) {
		if (voices[i] != null) {
			voices[i].updateOsc2Frequency();
		}
	}
}

function onUpdateOsc2Detune( ev ) {
	var value = ev.currentTarget.value;
	currentOsc2Detune = value;
	for (var i=0; i<255; i++) {
		if (voices[i] != null) {
			voices[i].updateOsc2Frequency();
		}
	}
}

function onUpdateOsc2Mix( ev ) {
	var value = ev.currentTarget.value;
	currentOsc2Mix = value;
	for (var i=0; i<255; i++) {
		if (voices[i] != null) {
			voices[i].updateOsc2Mix( value );
		}
	}
}

function onUpdateEnvA( ev ) {
	currentEnvA = ev.currentTarget.value;
}

function onUpdateEnvD( ev ) {
	currentEnvD = ev.currentTarget.value;
}

function onUpdateEnvS( ev ) {
	currentEnvS = ev.currentTarget.value;
}

function onUpdateEnvR( ev ) {
	currentEnvR = ev.currentTarget.value;
}

function onUpdateFilterEnvA( ev ) {
	currentFilterEnvA = ev.currentTarget.value;
}

function onUpdateFilterEnvD( ev ) {
	currentFilterEnvD = ev.currentTarget.value;
}

function onUpdateFilterEnvS( ev ) {
	currentFilterEnvS = ev.currentTarget.value;
}

function onUpdateFilterEnvR( ev ) {
	currentFilterEnvR = ev.currentTarget.value;
}

function onUpdateDrive( value ) {
	currentDrive = value;
    waveshaper.setDrive( 0.01 + (currentDrive*currentDrive/500.0) );
}

function onUpdateVolume( ev ) {
	volNode.gain.value = (ev.currentTarget ? ev.currentTarget.value : ev)/100;
}

function onUpdateReverb( ev ) {
	var value = ev.currentTarget ? ev.currentTarget.value : ev;
	value = value/100;

	// equal-power crossfade
	var gain1 = Math.cos(value * 0.5*Math.PI);
	var gain2 = Math.cos((1.0-value) * 0.5*Math.PI);

	revBypassGain.gain.value = gain1;
	revGain.gain.value = gain2;
}


function filterFrequencyFromCutoff( pitch, cutoff ) {
    var nyquist = 0.5 * audioContext.sampleRate;

//    var filterFrequency = Math.pow(2, (9 * cutoff) - 1) * pitch;
    var filterFrequency = Math.pow(2, (9 * cutoff) - 1) * pitch;
    if (filterFrequency > nyquist)
        filterFrequency = nyquist;
	return filterFrequency;
}


function keyDown( ev ) {


	var note = keys[ev.keyCode];
	if (note)
		noteOn( note + 12*(3-currentOctave), 0.75 );
	console.log( "key down: " + ev.keyCode );

	return false;
}

function keyUp( ev ) {
	if ((ev.keyCode==49)||(ev.keyCode==50)) {
		if (ev.keyCode==49)
			moDouble = false;
		else if (ev.keyCode==50)
			moQuadruple = false;
		changeModMultiplier();
	}

	var note = keys[ev.keyCode];
	if (note)
		noteOff( note + 12*(3-currentOctave) );
//	console.log( "key up: " + ev.keyCode );

	return false;
}

var pointers=[];

function touchstart( ev ) {
	for (var i=0; i<ev.targetTouches.length; i++) {
	    var touch = ev.targetTouches[0];
		var element = touch.target;

		var note = parseInt( element.id.substring( 1 ) );
		console.log( "touchstart: id: " + element.id + "identifier: " + touch.identifier + " note:" + note );
		if (!isNaN(note)) {
			noteOn( note + 12*(3-currentOctave), 0.75 );
			var keybox = document.getElementById("keybox")
			pointers[touch.identifier]=note;
		}
	}
	ev.preventDefault();
}

function touchmove( ev ) {
	for (var i=0; i<ev.targetTouches.length; i++) {
	    var touch = ev.targetTouches[0];
		var element = touch.target;

		var note = parseInt( element.id.substring( 1 ) );
		console.log( "touchmove: id: " + element.id + "identifier: " + touch.identifier + " note:" + note );
		if (!isNaN(note) && pointers[touch.identifier] && pointers[touch.identifier]!=note) {
			noteOff(pointers[touch.identifier] + 12*(3-currentOctave));
			noteOn( note + 12*(3-currentOctave), 0.75 );
			var keybox = document.getElementById("keybox")
			pointers[touch.identifier]=note;
		}
	}
	ev.preventDefault();
}

function touchend( ev ) {
	var note = parseInt( ev.target.id.substring( 1 ) );
	console.log( "touchend: id: " + ev.target.id + " note:" + note );
	if (note != NaN)
		noteOff( note + 12*(3-currentOctave) );
	pointers[ev.pointerId]=null;
	var keybox = document.getElementById("keybox")
	ev.preventDefault();
}

function touchcancel( ev ) {
	console.log( "touchcancel" );
	ev.preventDefault();
}

function pointerDown( ev ) {
	var note = parseInt( ev.target.id.substring( 1 ) );
	if (pointerDebugging)
		console.log( "pointer down: id: " + ev.pointerId
			+ " target: " + ev.target.id + " note:" + note );
	if (!isNaN(note)) {
		noteOn( note + 12*(3-currentOctave), 0.75 );
		var keybox = document.getElementById("keybox")
		pointers[ev.pointerId]=note;
	}
	ev.preventDefault();
}

function pointerMove( ev ) {
	var note = parseInt( ev.target.id.substring( 1 ) );
	if (pointerDebugging)
		console.log( "pointer move: id: " + ev.pointerId 
			+ " target: " + ev.target.id + " note:" + note );
	if (!isNaN(note) && pointers[ev.pointerId] && pointers[ev.pointerId]!=note) {
		if (pointers[ev.pointerId])
			noteOff(pointers[ev.pointerId] + 12*(3-currentOctave));
		noteOn( note + 12*(3-currentOctave), 0.75 );
		pointers[ev.pointerId]=note;
	}
	ev.preventDefault();
}

function pointerUp( ev ) {
	var note = parseInt( ev.target.id.substring( 1 ) );
	if (pointerDebugging)
		console.log( "pointer up: id: " + ev.pointerId + " note:" + note );
	if (note != NaN)
		noteOff( note + 12*(3-currentOctave) );
	pointers[ev.pointerId]=null;
	var keybox = document.getElementById("keybox")
	ev.preventDefault();
}

function onChangeOctave( ev ) {
	currentOctave = ev.target.selectedIndex;
}


function initialize() {

	window.addEventListener('keydown', keyDown, false);
	window.addEventListener('keyup', keyUp, false);
	setupSynthUI();

	isMobile = (navigator.userAgent.indexOf("Android")!=-1)||(navigator.userAgent.indexOf("iPad")!=-1)||(navigator.userAgent.indexOf("iPhone")!=-1);


}

window.onload=initialize;
