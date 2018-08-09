/*
 Copyright (c) 2010-2012 Brian Silverman, Barry Silverman, Ed Spittles

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

var cycle = 0;
var trace = Array();
var d = 0;
var chipname = 'ARM1';
var timeoutDelay = 125;

function loadProgram(){
    // a small test program or patch might be passed in the URL
    if (userCode.length != 0) {
        for( var i = 0; i < userCode.length; i++) {
            if (userCode[i] != undefined) {
                // byte address, word value
                mWrite(i, userCode[i]);
                // if(i<0x200)
                //    setCellValue(i, userCode[i]);  // word index, word value
            }
        }
    }
}

//function regStatus(){
//      return regNames.map(function(name){return name +': ' + hex(readReg(name))});
//}

function hex(n){
    if(n < 0){
        return (0xffffffff + n + 1).toString(16);
    }

    var s = n.toString(16);
    if (s.length < 8){
        s = ('00000000' + s).slice(-8);
    }

    return s;
}

function go() {
    if(typeof userSteps != "undefined"){
        if(--userSteps==0){
            running=false;
            userSteps=undefined;
        }
    }
    if(running) {
        step();
        // schedule the next poll.  60 is pretty fast
        setTimeout(go, timeoutDelay);
    }
}

function toggleFast() {
    var btn = document.getElementById('toggleFast');
    if (timeoutDelay == 125) {
        timeoutDelay = 0;
        if (btn) btn.value = 'Slow';
    }
    else {
        timeoutDelay = 125;
        if (btn) btn.value = 'Fast';
    }
}

function initChip(){
    var start = now();
    nodes.forEach(function(n){
        n.state = false;
        n.switched = 0;
        n.touched = 0;});

    nodes[nvss].state = false;
    nodes[nvdd].state = true;
    transistors.forEach(function(t){
        if (t.gate >= 10000)return;
        t.on = (nodes[t.gate].state==t.active);
        t.touched = 0;
        t.switched = 0;});

    recalcNodeList(allNodes()); 
    setPadLow('abrt');
    setPadHigh('ale');
    setPadHigh('firq');
    setPadHigh('irq');

    setPadLow('phi1');
    setPadLow('phi2');

    setPadHigh('dbe');
    setPadHigh('abe');
    setPadHigh('reset');
    for(var i=0;i<8;i++){setPadHigh('phi1'); setPadLow('phi1'); setPadHigh('phi2'); setPadLow('phi2');}
    setPadLow('reset');
    //refresh();
    armgpu.appInstance.setNodes();
    cycle = 0;
    trace = Array();
    chipStatus();
    setStatus('');
    if(ctrace)console.log('initChip done after', now()-start);
}

// simulate a single clock phase, updating trace and highlighting layout
function step(){
    //  var s=stateString();
    //  var m=getMem();
    //  trace[cycle]= {chip: s, mem: m};
    halfStep();
    //  refresh();
    armgpu.appInstance.setNodes();
    cycle++;
    chipStatus();
}

// simulate a single clock phase with no update to graphics or trace
function halfStep(){
    var clk = isPadHigh('phi1');
    if (clk) {setPadLow('phi1'); setPadHigh('phi2');  } 
    else { setPadLow('phi2'); handleBusRead(); setPadHigh('phi1'); handleBusWrite();}
}

function isPadHigh(name){
    var t = pads[name+'_pad'];
    var n = nodes[t.c1];
    return n.state
}

function handleBusRead(){
    if(!isPadHigh('rw')){
        d = mRead(readAddressBus());
        writeDataBus(d);
    }
}

function handleBusWrite(){
    if(isPadHigh('rw')){
        var a = readAddressBus();
        var d = readDataBus();
        mWrite(a,d);
        var i = Math.floor(a/4);
        var d = memory[i];
        //              if(a<0x200) setCellValue(i,d);
    }
}

function readAddressBus(){
    var a=0;
    for(var i=25;i>=0;i--){
        a<<=1;
        if(isPadHigh('a'+i)) a = a + 1;
    }
    return a;
}

function readDataBus(){
    var d=0;
    var recalcs = Array();

    for(var i=0;i<32;i++){
        // Tri-state the databus so we can read the bits
        var t = pads['d'+i+'_pad']
        t.on = false;
        recalcs.push(t.c1);
    }
    recalcNodeList(recalcs);

    for(var i=31;i>=0;i--){
        d<<=1;
        if(isPadHigh('d'+i)) d = d + 1;
    }
    return d;
}

function readRegHex(name){
    var val = readReg(name);
    if (typeof val == "undefined") return '';
    return hex(val);
}

function nodeListToInt(bits){
    var d=0;
    var n;
    for(var i=0; i<bits.length; i++){
        n = bits[i];
        d<<=1;
        if(nodes[n].state) d = d + 1;
    }
    return d;
}

function readNodeValueAsString(n){
    if (typeof nodes[n] == 'undefined')
        return 'x';
    var v=nodes[n].state;
    if ((typeof v == 'undefined') || (v==-1))
        return 'x';
    return v?'1':'0'
}

function readBus(name){
    if (! (name in internalBusses)) return undefined;
    return nodeListToInt(internalBusses[name]);
}

function readReg(name){
    name = regDisplayMap[name];
    if (! (name in regfile)) return undefined;
    return nodeListToInt(regfile[name]);
}

function readBits(name, n){
}

function writeDataBus(x){
    var recalcs = Array();
    for(var i=0;i<32;i++){
        var t = pads['d'+i+'_pad']
        if((x%2)==0) {t.on=true; t.c2=nvss;}
        else {t.on=true; t.c2=nvdd;}
        recalcs.push(t.c1);
        x>>=1;
    }
    recalcNodeList(recalcs);
}

function mRead(a){
    if(typeof memory[Math.floor(a/4)] == "undefined") return 0xea0000ff;
    else return memory[Math.floor(a/4)];   
}

function mWrite(a, d){
    var wordAddress = Math.floor(a/4);

    if(isPadHigh('bw')){
        memory[wordAddress]=d;
    } else {
        var oldVal = memory[wordAddress];
        var shift = ((a&3)*8);
        var mask = 0xff<<shift;         
        var newVal = d&mask;
        oldVal = oldVal & ~mask;
        memory[wordAddress] = (newVal+oldVal);
    }
}

function runChip(){
    var start = document.getElementById('start');
    var stop = document.getElementById('stop');
    start.style.visibility = 'hidden';
    stop.style.visibility = 'visible';
    if(typeof running == "undefined")
        initChip();
    running = true;
    go();
}

function stopChip(){
    var start = document.getElementById('start');
    var stop = document.getElementById('stop');
    start.style.visibility = 'visible';
    stop.style.visibility = 'hidden';
    running = false;
}

function resetChip(){
    stopChip();
    setStatus('resetting ' + chipname + '...');
    setTimeout(initChip,0);
}

function stepForward(){
    if(typeof running == "undefined")
        initChip();
    stopChip();
    step();
}

function stepBack(){
    //  if(cycle==0) return;
    //  showState(trace[--cycle].chip);
    //  setMem(trace[cycle].mem);
    //  var clk = isNodeHigh(nodenames['clk0']);
    //  if(!clk) writeDataBus(mRead(readAddressBus()));
    //  chipStatus();
}

function chipStatus(){
    updateFrontPanel();
    //  if((typeof(MemoryWindow) != "undefined") && (MemoryWindow.parent != null)){
    //          updateMemoryTable();
    //  }
}

function ckt(){
    return transistors.filter(function(t){
        if (typeof nodes[t.gate] == "undefined") return false;
        return (t.on != (t.active == nodes[t.gate].state));
    });
}



function getMem(){
    var res = Array();
    for(var i=0;i<0x200;i++) res.push(mRead(i));
    return res;
}

function setMem(arr){
    for(var i=0;i<0x200;i++){mWrite(i, arr[i]); setCellValue(i, arr[i]);}
}

function hexWord(n){return (0x10000+n).toString(16).substring(1)}
function hexByte(n){return (0x100+n).toString(16).substring(1)}

function now(){return  new Date().getTime();}

function list2tableRow(l, p){
    var props = "";
    if (typeof p != "undefined")
        props = p;
    var s= "<tr " + props + "><td>" + l.join("</td><td>") + "</td></tr>";
    return s;
}

function list2zebraTableRow(row, l, rowprops, cellprops){
    var ll=[];
    var odd=true;
    var bg;

    for(i=0; i<l.length; i++){
        if((row % 2) == 0){
            bg = odd ? "class=oddcol":"";
        } else {
            bg = odd ? "class=oddrow":"class=oddrowcol";
        }
        ll.push("<td " + bg + " " + cellprops + ">" + l[i] + "</td>");
        odd =! odd;
    }

    return "<tr " + rowprops + ">" + ll.join("") + "</td></tr>";
}
