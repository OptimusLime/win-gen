//need our general utils functions
module.exports = extendObject;

function extendObject(self, globalConfiguration, localConfiguration)
{
    //
    self.winFunction = "generator";

    //pull logging from the backbone -- handles all messages to the user
    self.log = self.bb.getLogger(self);
    self.log.logLevel = localConfiguration.logLevel || self.log.normal;
    
    //we need to turn localConfiguration into what we need!
    var rEncodings = localConfiguration.encodings || [];

    //encoding reference type
    var encode = self.rEvents["encoding"];

    //only optional events now- no required for encodings
    
    // for(var i=0; i < rEncodings.length; i++)
    // {
    //     var key = rEncodings[i];
    //     //from each encoding, we require the following events
    //     var reconstitute = key + "-" + "encodingFromJSON";
    //     var condense = key + "-" + "encodingToJSON";

    //     encode[reconstitute] = "encoding:" + reconstitute;
    //     encode[condense] = "encoding:" + condense;
    // }

    self.optionalEvents = function()
    {
        var optional = [];
        for(var i=0; i < rEncodings.length; i++)
        {
            var encoding = rEncodings[i];

            optional.push("encoding:" + encoding + "-createFullOffspring");
            optional.push("encoding:" + encoding + "-arraySelection");
            //handle everything except for the internal references
            optional.push("encoding:" + encoding + "-createNonReferenceOffspring");
            optional.push("encoding:" + encoding + "-chooseReferenceBehavior");

        }
        //there are all the optional events that may be called by this object
        return optional;
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

        self.log('Required gen events: ', events);

        //send back all required events
        return events;
    }

    self.initialize = function(done)
    {
        //set timeout available in and out of browser
       setTimeout(function()
        {
            done();
        }, 0);
    }
}




