//here we test the insert functions
//making sure the database is filled with objects of the schema type

var assert = require('assert');
var should = require('should');
var colors = require('colors');
var traverse = require('optimuslime-traverse');

var wingen = require('../');
var winback = require('win-backbone');

var backbone, generator;
var count = 0;

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

var refSchema = {
	simple : "string"
}

var sampleEncoding = 
{
	winFunction : "encoding",
	encodingName : "sample",
	sampleSchema : {
		first : "string"
		,second : {"$ref" : "refSchema"}
		,last : {type :"array", "$ref" : "refSchema"}
	},
	eventCallbacks : function()
	{ 
		return {
			// "encoding:sample-createFullOffspring" : function(genProps, parentProps, override, done) { 
			// 	backbone.log('called create full offspring ',arguments); 
			// 	var parents = parentProps.parents;
			// 	process.nextTick(function(){
			// 		done(undefined, 
			// 			[traverse(parents[0]).clone()
			// 			// ,{"junk" : "stuff"}
			// 			,traverse(parents[0]).clone()]
			// 			, [[0], [0]]);
			// 	});
			//  	return; 
			//  },
			 // "encoding:sample-"
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
        	if(err){
        		done(new Error(err));
        		return;
        	}

        	backbone.emit(sampleEncoding.winFunction, "schema:addSchema", "refSchema", refSchema, {skipWINAdditions : true}, function(err){

				if(err){
        			throw new Error(err);
        		}

        		//if we're done, pass it along friend
        		done();     

        	})
	
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
				,validateChildren : true

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
    		{ first : "duh", second : {simple: "stuff"}, last : [{simple : "easy"}]
    		,wid : "012345", parents : [], dbType : "sample"
    		}
    		// {"simple" : "stuff", "more" : "things"}
    	];

    	//now we call asking for 
    	backbone.emit("test", "generator:createArtifacts", "sample", 2, exampleEncodings, function(err, artifacts)
		{
			count++;

			backbone.log('Finished creating artifacts: ', err);
			if(err){
				done(new Error(JSON.stringify(err)));
				return;
			}
			else
			{
		    	backbone.log('Finished generating artifacts, ', artifacts);
		    	done();   

			}

		});
    
    });
});



