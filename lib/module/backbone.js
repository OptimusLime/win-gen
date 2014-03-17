//need our general utils functions
module.exports = extendObject;

function extendObject(self, configuration)
{
    //
    self.winFunction = "generator";

    self.rEvents = {encoding: {}};

    console.log("Generator Configs: ", configuration);
    
    //we need to turn configuration into what we need!
    var rEncodings = configuration.encodings || [];

    //encoding reference type
    var encode = self.rEvents["encoding"];
    
    for(var i=0; i < rEncodings.length; i++)
    {
        var key = rEncodings[i];
        //from each encoding, we require the following events
        //handle offspring creation, handle comining arrays of objects
        var offCreate = key + "-" + "createOffspring";
        var arrayLogic = key + "-" + "combineArrays";
        // var finalCall = key + "-" + "finishOffspring";

        encode[offCreate] = "encoding:" + offCreate;
        encode[arrayLogic] = "encoding:" + arrayLogic;

        var reconstitute = key + "-" + "encodingFromJSON";
        var condense = key + "-" + "encodingToJSON";
        var schema = key + "-" + "getEncodingShema";

        encode[reconstitute] = "encoding:" + offCreate;
        encode[condense] = "encoding:" + arrayLogic;
        encode[schema] = "encoding:" + schema;
    }



    self.requiredEvents = function()
    {
        //don't require any outside modules
        var events = [];
        var internalEvents= self.rEvents;
        //turn our events into an array
        //events are easier organized as an object, but for requirements, we send as array
        for(var func in internalEvents)
        {
            for(var action in internalEvents[func])
            {
                events.push(internalEvents[func][action]);
            }
        }

        console.log('Required gen events: ', events);

        //send back all required events
        return events;
    }

    self.initialize = function(done)
    {
        process.nextTick(function()
        {
            done();
        })
    }
}




