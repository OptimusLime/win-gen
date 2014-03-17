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

var sampleEncoding = 
{
	winFunction : "encoding",
	encodingName : "sample",
	eventCallbacks : function()
	{ 
		return {
			"encoding:sample-createOffspring" : function(count, parents, override, done) { 
				console.log('called create sample offspring ',arguments); 
				process.nextTick(function(){done(undefined, {"junk" : "stuff"});});
			 	return; 
			 },
			"encoding:sample-combineArrays" : function(){ console.log('called combine sample arrays ', arguments); return; },

			"encoding:sample-encodingToJSON" : function(){ console.log('called encodingToJSON ', arguments); return; },
			"encoding:sample-encodingFromJSON" : function(){ console.log('called encodingFromJSON', arguments); return; },
			"encoding:sample-getEncodingShema" : function(){ console.log('called sample-getEncodingShema ', arguments); return; }
		};
	},
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
			"sample-encoding" : sampleEncoding,
			"test" : emptyModule
		};
		var configurations = 
		{
			"win-gen" : {
				"encodings" : [
					"sample"
				]
			},
			"stuff" :
			{
				
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

    	var exampleEncodings = [
    		{"simple" : "stuff", "more" : "things"}
    	];

    	//now we call asking for 
    	backbone.emit("test", "generator:createArtifacts", "sample", 2, exampleEncodings, function()
		{


	    	console.log('stuff');
	    	done();   

		});
    
    });
});



