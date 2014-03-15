//here we test the insert functions
//making sure the database is filled with objects of the schema type

var assert = require('assert');
var should = require('should');
var util = require('util');

var winjs = require('../win-gen.js');

var mainGenerator = require('../generator/mainGenerator.js');
var winRegister = require('../main/win.js')

var winsave = require('../../win-save/win.js');
var winapp;
var winapi = require('win-api');

var winsaveAPI = winapi.loadLibraryFile('win-api', 'win-save');


var next = function(range)
{
    return Math.floor((Math.random()*range));
};

describe('Testing Generating Artifacts -',function(){

    //we need to start up the WIN backend
    before(function(done){

        winsave.launchWIN({artifactType: "schema1", directory: __dirname, seedDirectory: './testseeds', schemaDirectory: './'}, {port: 3000, modifier: 'test'}, function(err, app)
        {
            if(err)
                throw new Error('Messed up starting WIN tests- make sure mongo is running.');

            winapp = app;

            winjs.initializeWINGenerator(function()
            {
                //this actuall include intial schema and seed call
                done();
            });
        });

    });

    it('Should fetch the schema and a single seed',function(done){

        //generator should be ready to go now!
        //let's make an initiate request!
        winsaveAPI.initialSchemaAndSeed(function(stuff)
        {
//            console.log('Successful(!) schema and seed request');
//            console.log(util.inspect(stuff, true, 1));
            done();

        }, function(noStuff)
        {
//            console.log('Failed schema and seed request');
//            console.log(JSON.parse(noStuff));
            done();
        });
    });


    var combineReferences = function(seeds, refHolder)
    {
        var combined = {};
        for(var s in seeds)
        {
            var seed = seeds[s];
            var seedHolder = refHolder[seed];

            for(var key in seedHolder)
            {
                if(!combined[key])
                    combined[key] = [];

                combined[key] = combined[key].concat(seedHolder[key]);
            }
        }
        return combined;
    };

    var parentsSeen = function(parentIDs, allPathReferences)
    {
        var seen = false;
        for(var i=0; i < parentIDs.length; i++)
        {
            var parentID = parentIDs[i];

            for(var p in allPathReferences)
            {
                if(allPathReferences[p] === parentID)
                {
                    seen = true;
                    break;
                }
            }
            if(seen)
                return true;
        }

        return false;
    };


    it('Should create artifacts without parents (using seeds)',function(done){

        //generator should be ready to go now!
        //let's make a creation request!

        var getAPI = winapp.winRoutes.getAPI;
        var schemaLoader = winapp.winRoutes.schemaLoader;
        var wutil = winapp.winRoutes.utilities;
        var om = wutil.objectManipulator;

        var creationTests = 1;

        //grab all seeds for verification later
        var allSeeds = winRegister.allSeeds();

        var seedIDs = [];

        var sessionID;
        var allSeedReferences = {};
        for(var i=0; i < allSeeds.length; i++)
        {
            var seed = allSeeds[i];
            seedIDs.push(seed.wid);
            allSeedReferences[seed.wid] = getAPI.collectReferenceWidsFromObjects('schema1', [seed]);

            sessionID = allSeeds[i].creation.sessionID;
        }

        console.log('\n Seed Refs found: ' + util.inspect(allSeedReferences,true, 2));



        for(var i=0; i < creationTests; i++)
        {

            //1 to 10 offspring
            var offspringCount = 1;// + next(10);

            //get a random seed, make sure it checks out? validate?
            var schemaArtifacts = mainGenerator.createArtifacts({sessionID: sessionID, timeOfCreation: Date.now(), isPublic: false}, offspringCount, 'schema1');
//            console.log(util.inspect(schemaArtifacts, true, 4));

            for(var key in schemaArtifacts)
            {
                var artifact = schemaArtifacts[key];

                //let's put it through the wringer!

                //check the parents -- since we are choosing 1 seed (this is the current policy might change)
                artifact.parents.length.should.be.above(0);

                //these are all the paths and reference objects we can hit up for seeding
                //our offspring MUST reference at least one of the seeds -- to ensure parent properties are properly supported
                var allPossibleParentReferences = combineReferences(artifact.parents, allSeedReferences);


                //make sure that the artifacts parents are one of the seeds
                var sawSeedID = parentsSeen(artifact.parents, seedIDs);

                sawSeedID.should.equal(true);


                var artifactParents = {};


                var fullRefs = schemaLoader.getFullSchemaReferences();

                //more importantly thought, through the whole object, parents should be verified -- this is a vital feature
//                getAPI.findReferencesInObjects('schema1', [artifact],
                    om.traverseReferences( [artifact], fullRefs['schema1'],
                        function(refFound, foundObjects, refPath)
                {
                    if(!artifactParents[refPath])
                        artifactParents[refPath] = [];

                    for(var fo in foundObjects)
                        artifactParents[refPath] = artifactParents[refPath].concat(foundObjects[fo].parents);

                });

//                console.log('\nReferences parents in artifacts: \n' + util.inspect(artifactParents, true,2));

                for(var path in artifactParents)
                {
//                    console.log('\nAParRefr: ' +  util.inspect(artifactParents[path], false,2) + ' \naSeedRef: ' +  util.inspect(allPossibleParentReferences[path], false, 2));
                    parentsSeen(artifactParents[path], allPossibleParentReferences[path]).should.equal(true);
                }

            }


        }


        done();

        //holy poop if that works!

    });


});
