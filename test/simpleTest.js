//here we test the insert functions
//making sure the database is filled with objects of the schema type

var assert = require('assert');
var should = require('should');
var colors = require('colors');

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
	sampleSchema : {
		first : "string",
		second : "number",
		third : {
			fourth : "string"
		}
	},
	eventCallbacks : function()
	{ 
		return {
			"encoding:sample-createOffspring" : function(count, parents, override, done) { 
				backbone.log('called create sample offspring ',arguments); 
				process.nextTick(function(){done(undefined, {"junk" : "stuff"});});
			 	return; 
			 },
			"encoding:sample-combineArrays" : function(){ backbone.log('called combine sample arrays ', arguments); return; },
			"encoding:sample-encodingToJSON" : function(){ backbone.log('called encodingToJSON ', arguments); return; },
			"encoding:sample-encodingFromJSON" : function(){ backbone.log('called encodingFromJSON', arguments); return; },
			"encoding:sample-getEncodingShema" : function(){ backbone.log('called sample-getEncodingShema ', arguments); return; }
		};
	},
	requiredEvents : function() {
		return [
		"schema:addSchema",
		"generator:createArtifacts"
		];
	},
	initialize : function(done)
    {
    	backbone.log("Init encoding");
        backbone.emit(sampleEncoding.winFunction, "schema:addSchema", sampleEncoding.encodingName, sampleEncoding.sampleSchema, function(err)
        {
        	if(err)
        	{
        		throw new Error(err);
        	}
        	//if we're done, pass it along friend
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
			"win-schema" : "win-schema",
			"sample-encoding" : sampleEncoding,
			"test" : emptyModule
		};
		var configurations = 
		{
			"win-gen" : {
				"encodings" : [
					"sample"
				]
				,validateParents : true

			},
			"win-schema" : {
				multipleErrors : true
			},
			"stuff" :
			{
				
			}
		};

    	backbone = new winback();
    	backbone.log.logLevel = backbone.log.testing;

    	//loading modules is synchronous
    	backbone.loadModules(sampleJSON, configurations);

    	var registeredEvents = backbone.registeredEvents();
    	var requiredEvents = backbone.moduleRequirements();
    		
    	backbone.log('Backbone Events registered: ', registeredEvents);
    	backbone.log('Required: ', requiredEvents);

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
    	backbone.emit("test", "generator:createArtifacts", "sample", 2, exampleEncodings, function(err, artifacts)
		{
			console.log('Finished creating artifacts: ', err);
			if(err){
				
				done(new Error(JSON.stringify(err.errors)));
			}
			else
			{
		    	backbone.log('Finished generating artifacts, ', artifacts);
		    	done();   

			}

		});
    
    });
});



