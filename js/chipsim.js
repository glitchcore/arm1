var nodes = new Array(), transistors = new Array(); 
var nvss=0, nvdd=1;
var ctrace = false;
var traceTheseNodes = [];
var traceTheseTransistors = [];
var loglevel = 0;
var recalclist = new Array();
var recalcHash = new Array();
var group = new Array();
var pads = [];

/////////////////////////
//
// Setup
//
/////////////////////////

function setupNodes(){
    for (var i = 0; i < 8760; i++) {
        nodes[i] = {num: i, state: -1, gates: [], c1c2s: [], 
                    plotted: 0, touched:0, switched:0, flipFlop: false};
    }
    for(var i = 0; i < ffdefs.length; ++i) {
	nodes[ffdefs[i]].flipFlop = true;
    }
}

function setupTransistors(){
	for(i=0;i<transdefs.length;i+=5){
		var trans = {};
		var num = i/5;
		transistors[num] = trans;
		trans.touched = 0;
		trans.switched = 0;
		trans.gate = Math.abs(transdefs[i]);
		trans.num = num;
		trans.active = (transdefs[i]>=0);
		trans.x = transdefs[i+3];
		trans.y = transdefs[i+4];
		trans.c1 = transdefs[i+1];
		nodes[trans.c1].c1c2s.push(trans);
		trans.on = false;
		switch(trans.gate){

		// output pad
		case 10000:{
			pads[nodenames[trans.c1]] = trans;
			break;}

		// input pad
		case 10001: {
			trans.c2 = nvss;
			pads[nodenames[trans.c1]] = trans;
			trans.on = true;
			break;}

		// io pad
		case 10002: {
			trans.c2 = nvss;
			pads[nodenames[trans.c1]] = trans;
			break;}

		// gate is vss
		case 10003:{
			trans.gate = nvss;
			trans.c2 = transdefs[i+2];
			nodes[trans.c2].c1c2s.push(trans);
			if (!trans.active)
				trans.on = true;
			break;}

		// gates is vdd
		case 10004:{
			trans.gate = nvdd;
			trans.c2 = transdefs[i+2];
			nodes[trans.c2].c1c2s.push(trans);
			if (trans.active)
				trans.on = true;
			break;}
			
		default: {
			trans.c2 = transdefs[i+2];
			nodes[trans.gate].gates.push(trans);
			nodes[trans.c2].c1c2s.push(trans);
			break;}
		}
	}
}



/////////////////////////
//
// Runtime
//
/////////////////////////


function recalcNodeList(list){
	var n = list[0];
	recalclist = new Array();
	recalcHash = new Array();
	for(var j=0;j<100;j++){		// loop limiter
		if(list.length==0) return;
		if(ctrace) {
			var i;
			for(i=0;i<traceTheseNodes.length;i++) {
				if(list.indexOf(traceTheseNodes[i])!=-1) break;
			}
			if((traceTheseNodes.length==0)||(list.indexOf(traceTheseNodes[i])==-1)) {
				console.log('recalcNodeList iteration: ', j, list.length, 'nodes');
			} else {
				console.log('recalcNodeList iteration: ', j, list.length, 'nodes', list);
			}
		}
		list.forEach(recalcNode);
		list = recalclist;
		recalclist = new Array();
		recalcHash = new Array();
	}
	if(ctrace) console.log(n,'looping...');
}

function recalcNode(node){
	if(node==nvss) return;
	if(node==nvdd) return;
	getNodeGroup(node);
	var newState = getNodeValue();
	if(ctrace && (traceTheseNodes.indexOf(node)!=-1))
		console.log('recalc', node, group);
	group.forEach(function(i){
		var n = nodes[i];
		if(n.state==newState) return;
		n.switched++;
		n.state = newState;
		n.gates.forEach(function(t){
			if(n.state==t.active) turnTransistorOn(t);
			else turnTransistorOff(t);});
	});
}

function setRegisterNode(node, value){
	if(node==nvss) return;
	if(node==nvdd) return;
	if(node.state==value)return;

	recalclist = new Array();
	recalcHash = new Array();

	getNodeGroup(node);
	// Set the register node by simulating a connection to VSS or VDD
	// Since the register is a flip-flop, any VSS->VDD shorts will be resolved
	
	if(value)
		group.push(1);
	else
		group.push(0);

	var newState = getNodeValue();
	if(ctrace && (traceTheseNodes.indexOf(node)!=-1))
		console.log('recalc', node, group);
	group.forEach(function(i){
		var n = nodes[i];
		if(n.state==newState) return;
		n.switched++;
		n.state = newState;
		n.gates.forEach(function(t){
			if(n.state==t.active) turnTransistorOn(t);
			else turnTransistorOff(t);});
	});

	// Recalculate any side effects
	recalcNodeList(recalclist);
}

function turnTransistorOn(t){
	t.touched++;
	if(t.on) return;
	t.switched++;
	if(ctrace && (traceTheseTransistors.indexOf(t.name)!=-1))
		console.log(t.name, 'on', t.gate, t.c1, t.c2);
	t.on = true;
	addRecalcNode(t.c1);
// 	c1 must never be vss or vdd for this optimization to work
//	addRecalcNode(t.c2);

}

function turnTransistorOff(t){
	t.touched++;
	if(!t.on) return;
	t.switched++;
	if(ctrace && (traceTheseTransistors.indexOf(t.name)!=-1))
		console.log(t.name, 'off', t.gate, t.c1, t.c2);
	t.on = false;
	addRecalcNode(t.c1);
	addRecalcNode(t.c2);
}

function addRecalcNode(nn){
       if(nn==nvss) return;
       if(nn==nvdd) return;
       if(recalcHash[nn] == 1)return; 
       recalclist.push(nn);
       recalcHash[nn] = 1;
}

function getNodeGroup(i){
	group = new Array();
	addNodeToGroup(i);
}

function addNodeToGroup(i){
	if(group.indexOf(i) != -1) return;
	group.push(i);
	if(i==nvss) return;
	if(i==nvdd) return;
	nodes[i].touched++;
	nodes[i].c1c2s.forEach(
		function(t){
			if(!t.on) return;
			var other;
			if(t.c1==i) other=t.c2;
			if(t.c2==i) other=t.c1;
			addNodeToGroup(other);});
}


function getNodeValue(){
	var hasVss = false;
	var hasVdd = false;
	var hasFlipFlop = false;
	var flipFlopValue;

	// Scan the node group once completely for VSS, VDD and any flip-flop nodes

	group.forEach(function(n){
		if(n == nvss) hasVss = true;
		if(n == nvdd) hasVdd = true;
			
		if(nodes[n].flipFlop) {
			flipFlopValue = nodes[n].state;
			hasFlipFlop = true;
		}
	});

	// if we have a short (power connected to ground), and the group contains a flip-flop - we assume that the designer 
	// wanted to switch the flip flop. Return the value that flips the flip flop.

	if(hasVss && hasVdd){
		// Handle case of flip flops which are cross connected gates - calculated at transistor load time.
		// Node X gates Node Y and Node Y gates Node X

		if(hasFlipFlop)
			return(!flipFlopValue);
	}

	// Use Existing rules
	if(hasVss)return false;
	if(hasVdd)return true;

	for(var i in group){
		var nn = group[i];
		var n = nodes[nn];
		if(n.state) return true;
	}

 	return false;
}


function isNodeHigh(nn){
	return((nodes[nn].state));
}

function allNodes(){
	var res = new Array();
	nodes.forEach(function(n){
		if((n.num!=nvdd)&&(n.num!=nvss))res.push(n.num);
	});
	return res;
}


function setPadLow(name){
	var t = pads[name+'_pad'];
	t.on = true;
	t.c2 = nvss;
	recalcNodeList([t.c1]);
}

function setPadHigh(name){
	var t = pads[name+'_pad'];
	t.on = true;
	t.c2 = nvdd;
	recalcNodeList([t.c1]);
}

function arrayContains(arr, el){return arr.indexOf(el)!=-1;}
