//here we test the insert functions
//making sure the database is filled with objects of the schema type

var assert = require('assert');
var should = require('should');

var wingen = require('../');
var winback = require('win-backbone');

var backbone, generator;

var emptyModule = 
{
	winFunction : "test",
	eventCallbacks : function(){ return {}; },
	requiredEvents : function() {
		return ["generator:createArtifacts"];
	},
	initialize : function(done)
    {
        process.nextTick(function()
        {
            done();
        })
    }
};

describe('Testing Win Generating Artifacts -',function(){

    //we need to start up the WIN backend
    before(function(done){

    	var sampleJSON = 
		{
			"win-gen" : wingen,
			"test" : emptyModule,
		};
		var configurations = 
		{
			"win-gen" : {},
			"stuff" :
			{
				"encodings" : "dunno"
			}
		};

    	backbone = new winback();

    	//loading modules is synchronous
    	backbone.loadModules(sampleJSON, configurations);

    	var registeredEvents = backbone.registeredEvents();
    	var requiredEvents = backbone.moduleRequirements();
    		
    	console.log('Backbone Events registered: ', registeredEvents);
    	console.log('Required: ', requiredEvents);

    	backbone.initializeModules(function()
    	{
 			done();
    	});

    });

    it('Should create verified artifact JSON',function(done){

    	var exampleEncodings = [];

    	//now we call asking for 
    	backbone.emit("test", "generator:createArtifacts", "sample", 2, exampleEncodings);

    	console.log('stuff');
    	done();       
    });
});



