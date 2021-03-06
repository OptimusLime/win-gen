//here we test the insert functions
//making sure the database is filled with objects of the schema type

var assert = require('assert');
var should = require('should');
var colors = require('colors');
var traverse = require('optimuslime-traverse');

var util = require('util');

var wingen = require('../');
var wMath = require('win-utils').math;
var winback = require('win-backbone');

var backbone, generator, backEmit, backLog;
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
			// 	backLog('called create full offspring ',arguments); 
			// 	var parents = parentProps.parents;
				
			// 	var count = genProps.count;

			// 	var allParents = [];
			// 	var children = [];

			// 	for(var c=0; c < count; c++)
			// 	{
			// 		var ixs = [];
			// 		var pIx = wMath.next(parents.length);
			// 		var rOffspring = traverse(parents[pIx]).clone();									
			// 		rOffspring.first = parents[pIx].first + "-" + c;
			// 		// rOffspring.second = "This will be erased.";

			// 		ixs.push(pIx);
			// 		children.push(rOffspring);
			// 		allParents.push(ixs);
			// 	}

			// 	//done, send er back
			// 	done(undefined, children, allParents);

			//  	return; 
			//  },
			//randomly replaces the non-reference objects with those from the parent -- nothing complicated
			"encoding:sample-createNonReferenceOffspring" : function(genProps, parentProps, override, done){
				//we create stuff here
				var parents = parentProps.parents;
				var count = genProps.count;

				var allParents = [];
				var offspring = [];

				for(var c=0; c < count; c++)
				{
					var rOffspring = {};
					
					var ixs = [];
					var pIx = wMath.next(parents.length);
					rOffspring.first = parents[pIx].first + "-" + c;
					rOffspring.second = "This will be erased.";
					ixs.push(pIx);

					offspring.push(rOffspring);
					allParents.push(ixs);
				}
				// backLog("Parents for non-ref: ".cyan, allParents);
				//done, send er back
				done(undefined, offspring, allParents);

			},
			//randomly replaces one of the references with the saem object from the parents
			//simple
			"encoding:sample-chooseReferenceBehavior" : function(refPaths, genProps, parentProps, override, done){

				backLog("\n\tref paths req: ".cyan, refPaths, "\n");

				var parents = parentProps.parents;
				var count = genProps.count;
				var refToReplace = refPaths[wMath.next(refPaths.length)];

				var refChildren = [];
				var refParentIxs = [];
				//have to replace inside all the children
				for(var c=0; c < count; c++)
				{	
					//just pull that object from the parents
					var ixs = [];
					var pIx = wMath.next(parents.length);
					var obj = traverse(parents[pIx]).get(refToReplace.split("///"));

					refChildren.push(obj);
					refParentIxs.push(ixs);
				}
				var rObject = {};
				rObject[refToReplace] =  {offspring: refChildren, parentIxs: refParentIxs};
				backLog("\n\tREplacements: ".yellow, util.inspect(rObject, false, 10), "\n");
				done(undefined, rObject);
			}
			// ,	
			// "encoding:sample-encodingToJSON" : function(){ backLog('called encodingToJSON ', arguments); return; },
			// "encoding:sample-encodingFromJSON" : function(){ backLog('called encodingFromJSON', arguments); return; },
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
    	backLog("Init encoding");

    	var emitter = backbone.getEmitter(sampleEncoding);
        emitter.emit("schema:addSchema", sampleEncoding.encodingName, sampleEncoding.sampleSchema, function(err)
        {
        	if(err){
        		done(new Error(err));
        		return;
        	}

        	emitter.emit("schema:addSchema", "refSchema", refSchema, {skipWINAdditions : true}, function(err){

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

    	//do this up front yo
    	backbone = new winback();


    	var sampleJSON = 
		{
			"win-gen" : wingen,
			"win-schema" : "win-schema",
			"sample-encoding" : sampleEncoding,
			"test" : emptyModule
		};
		var configurations = 
		{
			"global" : {
			},
			"win-gen" : {
				"encodings" : [
					"sample"
				]
				,logLevel : backbone.testing
				,validateParents : true
				,validateOffspring : true

			},
			"win-schema" : {
				multipleErrors : true
				// ,logLevel : backbone.testing

			},
			"stuff" :
			{
				
			}
		};

    	backbone.logLevel = backbone.testing;

    	backEmit = backbone.getEmitter(emptyModule);
    	backLog = backbone.getLogger({winFunction:"mocha"});
    	backLog.logLevel = backbone.testing;

    	//loading modules is synchronous
    	backbone.loadModules(sampleJSON, configurations);

    	var registeredEvents = backbone.registeredEvents();
    	var requiredEvents = backbone.moduleRequirements();
    		
    	backLog('Backbone Events registered: ', registeredEvents);
    	backLog('Required: ', requiredEvents);

    	backbone.initializeModules(function()
    	{
 			done();
    	});

    });

    it('Should create verified artifact JSON',function(done){

    	var exampleEncodings = [
    		{ first : "duh", second : {simple: "stuff"}, last : [{simple : "easy"}]
    		,wid : "012345", parents : [], dbType : "sample"
    		},
			{ first : "mofo", second : {simple: "giify"}, last : [{simple : "happy"}]
    		,wid : "543210", parents : [], dbType : "sample"
    		}
    		// {"simple" : "stuff", "more" : "things"}
    	];

    	//now we call asking for 
    	backEmit("generator:createArtifacts", "sample", 2, exampleEncodings, function(err, artifacts)
		{
			count++;
			if(err){
				done(new Error(JSON.stringify(err)));
				return;
			}
			else
			{
		    	backLog('\tFinished generating artifacts, '.cyan, util.inspect(artifacts, false,10));
		    	done();   

			}

		});
    
    });
});



