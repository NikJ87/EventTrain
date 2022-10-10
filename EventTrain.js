/**
 * @param win
 * @param doc
 * @param domRef
 */
const EventTrain = (function (
    win,
    doc,
    undefined
) {
    const EVENT_SOURCE_IFRAME = 'IFRAME';
    const EVENT_SOURCE_PORTAL = 'PORTAL';
    const EVENT_SOURCE_PARENT = 'PARENT';
    const EVENT_STATUS_LOADING = 'LOADING';
    const EVENT_STATUS_FAILED = 'FAILED';
    const EVENT_STATUS_IDLE = 'IDLE';
    const DOM_EXCEPTION_SAME_ORIGIN = 'SecurityError';
    const CODE_DOM_EXCEPTION_SAME_ORIGIN = 18;

    const LogLevel = {
        TRACE: 'trace',
        ERROR: 'error',
        WARN: 'warn',
        LOG: 'log',
        ALL: 'all',
    }

    const Exposed_Targets = {
        publish: 'publish',
        publishStatus: 'publishStatus',
        subscribe: 'subscribe',
        subscribeStatus: 'subscribeStatus',
        unsubscribe: 'unsubscribe',
        unsubscribeStatus: 'unsubscribeStatus',
        unsubscribeAll: 'unsubscribeAll',
        registerIFrameSelectors: 'registerIFrameSelectors',
        registerPublicEvents: 'registerPublicEvents',
        registerPrivateEvents: 'registerPrivateEvents',
        getRegisteredIframeSelectors: 'getRegisteredIframeSelectors',
        activities: 'activities',
        createWagonInstance: 'createWagonInstance'
    }

    const wagons = [];

    const $console = {
        _: (level, target, ...data) => {
            if (target && level) {
                const targetedLevel = logging.inspectLogLevelByTarget(target);

                if (targetedLevel && targetedLevel.includes(LogLevel.ALL)) {
                    console[LogLevel.ALL === level ? LogLevel.LOG : level](...data);
                } else if (targetedLevel && targetedLevel.includes(level)) {
                    console[level](...data);
                }
            }
        },
        log: (target, ...data) => {
            $console._(LogLevel.LOG, target, data);
        },
        error: (target, data) => {
            $console._(LogLevel.ERROR, target, ...data);
        },
        warn: (target, ...data) => {
            $console._(LogLevel.WARN, target, ...data);
        },
        trace: (target, ...data) => {
            $console._(LogLevel.TRACE, target, ...data);
        },
        all: (target, ...data) => {
            $console._(LogLevel.ALL, target, ...data);
        },
        groupCollapsed: (target, level, ...data) => {
            console.groupCollapsed(data && data[0] ? data[0] : '');
            $console._(level, target, ...data);
        },
        groupEnd: () => {
            console.groupEnd();
        },
    };

    const $utils = {
        isIframe: () => {
            return window.location !== window.parent.location;
        },
        convertToArray: (items) => {
            if (items) {
                if (Array.isArray(items)) return items;
                else return [items];
            }
            return [];
        },
        createSet: (existingArray, newArray) => {
            return new Set(
                [
                    ...Array.from(existingArray),
                    ...$utils.convertToArray(newArray),
                ].filter((e) => e)
            );
        },
        /***
         * generate timestamp in specific format
         * @return (string}
         */
        getTimestamp: () => {
            return new Date().toLocaleString();
        },
        now: () => {
            return new Date().getTime();
        },
        hash: (name) => {
            return (
                btoa(Math.random().toString(36)).slice(-7, -2) +
                btoa((+new Date()).toString(36)).slice(-7, -2) +
                btoa(name).slice(-7, -2)
            );
        },
    };

    const activityTracker = (() => {
        const tracker = [];

        const post = (activityInfo) => {
            const now = $utils.now()
            tracker.push({timestamp: now, ...activityInfo});
        };


        return {
            post,
            showAll: () => {
                return tracker.sort((former, later) => former.timestamp - later.timestamp
                );
            },
        }
    })();

    /**
     * LOG level can be defined for each internal function ?? just for troubleshooting purpose
     * @type {{inspectLogLevelByTarget: (function(*)), inspectLogLevel: (function(): ()), changeLogLevel: changeLogLevel}}
     */
    const logging = (() => {
        const logLevelByTargets = {};
        const inspectLogLevel = () => logLevelByTargets;
        const inspectLogLevelByTarget = (target) => {
            return logLevelByTargets[target] ?? undefined;
        };
        const changeLogLevel = (amendLogLevelByTarget) => {
            Object.assign(logLevelByTargets, amendLogLevelByTarget);
        };

        const exposedTargetsLogLevel = {
            [Exposed_Targets.publish]: [],
            [Exposed_Targets.publishStatus]: [],
            [Exposed_Targets.subscribe]: [],
            [Exposed_Targets.subscribeStatus]: [],
            [Exposed_Targets.unsubscribe]: [],
            [Exposed_Targets.unsubscribeStatus]: [],
            [Exposed_Targets.unsubscribeAll]: [],
            [Exposed_Targets.registerIFrameSelectors]: [],
            [Exposed_Targets.registerPublicEvents]: [],
            [Exposed_Targets.registerPrivateEvents]: [],
            [Exposed_Targets.getRegisteredIframeSelectors]: [],
            [Exposed_Targets.activities]: [],
            [Exposed_Targets.createWagonInstance]: [LogLevel.ERROR, LogLevel.WARN],
        }

        changeLogLevel(exposedTargetsLogLevel);

        return {
            changeLogLevel,
            inspectLogLevel,
            inspectLogLevelByTarget,
        }
    })();

    const subscribers = (() => {
        const targetedName = 'subscribers';

        logging.changeLogLevel({[targetedName]: [LogLevel.ERROR, LogLevel.WARN]});

        let subscribersCollection = []; // track all subscriptions

        const assign = (updatedCollection) => {
            subscribersCollection = updatedCollection;
        };

        const clone = () => subscribersCollection.slice();

        const filter = (expression) => {
            return subscribersCollection.filter((subscriber) =>
                expression(subscriber.eventName)
            );
        };

        /**
         * common pattern to push to subscribers list to avoid redundancy and mistakes
         * @param eventName
         * @param callBack
         */
        const push = (eventName, callBack) => {
            subscribersCollection.push({
                eventName,
                callBack,
            });
        };

        /**
         * Find matched subscribers using event name
         * @param eventName
         * @return {(function(): void)|*|*[]}
         */
        const fetchByEventName = (eventName) => {
            let matchedSubscribers = null;
            const callbackCollection = [];
            try {
                // Todo wildcard match
                $console.all(
                    targetedName,
                    `all subscribers : ${subscribersCollection}`
                );
                matchedSubscribers = filter((subscribedEventName) => subscribedEventName === eventName
                );

                if (matchedSubscribers && Array.isArray(matchedSubscribers) && matchedSubscribers.length > 0) {
                    matchedSubscribers.forEach((subscriber) => {
                        callbackCollection.push(subscriber.callBack);
                    });
                }

                // Todo condition check for wildcards
                $console.log(targetedName, `callback function count for $(eventName} : ${callbackCollection.length}`);


                return callbackCollection;

            } catch (e) {
                return () => {
                    $console.error(targetedName, 'ERROR finding matched subscribed callbacks :');
                };
            }
        };

        /**
         * It'Il execute all the matched events using data from event
         * @param event
         */
        const executing = (event) => {
            $console.log(targetedName, 'executing all callbacks ', event);

            // Todo proper check based on event/payload structure
            if (event?.data?.detail) {
                $console.all(
                    targetedName,
                    'pushing details at event level from event.data',
                    event
                );
                event.detail = event?.data?.detail;
            }
            if (event?.detail) {

                const {eventName} = event?.detail;
                // Todo :: extensive check for Private, Public and default event register
                /** private event shall be based on dom ref ?? */


                const eventNames = eventsInventory.check(eventName, 'callback');
                eventNames.forEach((_eventName) => {
                    fetchByEventName(_eventName)?.forEach((callBack) => {
                        $console.log(
                            targetedName,
                            `exe callbacks by event name : ${_eventName}`
                        );
                        callBack(event);
                    });
                });
            }
        };

        return {
            push,
            assign,
            clone,
            filter,
            executing,
        }
    })();


    // ToDo probably merge returned object with passed params
    const processors = (() => {
        const targetedName = 'processors';
        logging.changeLogLevel({[targetedName]: [LogLevel.ERROR, LogLevel.WARN]});

        const Processor_Targets = {
            default: 'default',
            publish: 'publish',
            publishStatus: 'publishStatus',
            subscribe: 'subscribe',
            subscribeStatus: 'subscribeStatus',
            unsubscribe: 'unsubscribe',
            unsubscribeStatus: 'unsubscribeStatus',
            unsubscribeAll: 'unsubscribe All',
        };

        const Processor_Targets_Defs = {
            [Processor_Targets.default]: undefined,
            [Processor_Targets.publish]: undefined,
            [Processor_Targets.publishStatus]: undefined,
            [Processor_Targets.subscribe]: undefined,
            [Processor_Targets.subscribeStatus]: undefined,
            [Processor_Targets.unsubscribe]: undefined,
            [Processor_Targets.unsubscribeStatus]: undefined,
            [Processor_Targets.unsubscribeAll]: undefined,
        };

        /**
         * will execute in the very beginning of each exposed function. like LOG tracing or some condition check
         * @type {{"[Exposed_Targets.default]": *, [Exposed_Targets.publish]": *,  [Exposed_Targets.publishStatus]": *, "[Exposed_Targets.unsubscribeAll]": *, "[Exposed_Targets.unsubscribeStatus]": *,  "[Exposed_Targets.unsubscribe]": *, "[Exposed_Targets.subscribe]": *, "[Exposed_Targets.subscribeStatus]": *,}}
         */
        const preProcessors = {...Processor_Targets_Defs};

        /**
         * will execute at the end of each exposed function. like LOG tracing or some condition check
         * @type {{"[Exposed_Targets.default]": *, [Exposed_Targets.publish]": *,  [Exposed_Targets.publishStatus]": *, "[Exposed_Targets.unsubscribeAll]": *, "[Exposed_Targets.unsubscribeStatus]": *,  "[Exposed_Targets.unsubscribe]": *, "[Exposed_Targets.subscribe]": *, "[Exposed_Targets.subscribeStatus]": *,}}
         */
        const postProcessors = {...Processor_Targets_Defs};

        const getProcessorTargets = () => Processor_Targets;

        const isOverridingProcessor = (existingProcessors, newProcessors) => {
            const newProcessorsTargets = Object.keys(newProcessors);

            const definedExistingProcessors = Object.keys(existingProcessors).filter(
                (target) =>
                    existingProcessors[target] && newProcessorsTargets.includes(target)
            )
            return definedExistingProcessors && definedExistingProcessors.length > 0;
        };

        const executePreProcessor = (target, ...args) => {
            $console.log(targetedName, `${targetedName} Executing Pre processor for [${target}]`);

            $console.all(targetedName, `Pre processor args passed for ${target} : `, {...args});

            return preProcessors[target]
                ? preProcessors[target](...args)
                : preProcessors[Exposed_Targets.default]
                    ? preProcessors[Exposed_Targets.default](...args)
                    : [...args];
        };


        const executePostProcessor = (target, ...args) => {
            $console.log(targetedName, `${targetedName} Executing Post processor for [${target}]`);

            $console.all(targetedName, `Post processor args passed for ${target} : `, {...args});

            return postProcessors[target]
                ? postProcessors[target](...args)
                : postProcessors[Exposed_Targets.default]
                    ? postProcessors[Exposed_Targets.default](...args)
                    : [...args];
        };

        const addPreProcessors = (_preProcessors) => {
            $console.all(targetedName, 'adding pre processor');

            const isPreProcessorOverriding = isOverridingProcessor(preProcessors, _preProcessors);

            if (isPreProcessorOverriding)
                $console.warn(targetedName, 'be careful while overriding the pre processors');

            Object.assign(preProcessors, _preProcessors);
        };

        const addPostProcessors = (_postProcessors) => {
            $console.all(targetedName, 'adding post processor');

            const isPostProcessorOverriding = isOverridingProcessor(postProcessors, _postProcessors);

            if (isPostProcessorOverriding)
                $console.warn(targetedName, 'be careful while overriding the post processors');

            Object.assign(postProcessors, _postProcessors);
        };

        return {
            getProcessorTargets,
            executePreProcessor,
            executePostProcessor,
            addPreProcessors,
            addPostProcessors,
        };
    })();


    // ToDo => pattern check =› iFrame-Selectors
    // region{scope}-appname{,appType}-section-iFramed
    const iframeInventory = (() => {

        const targetedName = 'iframeInventory';
        logging.changeLogLevel({[targetedName]: [LogLevel.ERROR, LogLevel.WARN]});

        let selectors = [];

        const assign = (updatedCollection) => {
            selectors = updatedCollection;
        };

        const clone = () => selectors.slice();

        const merge = (addCollection) => {
            return [...clone(), $utils.convertToArray(addCollection)];
        };

        const fetch = () => [...selectors];

        const registerSelectors = (addOnSelectors) => {
            $console.log(targetedName, 'registering frame selectors :', addOnSelectors);
            activityTracker.post({
                iframeSelectors: addOnSelectors,
                invokedBy: targetedName,
                source: EVENT_SOURCE_PORTAL,
            });
            assign(Array.from($utils.create.Set(merge(addOnSelectors))));
            $console.all(targetedNarne, 'registered iframe selectors : ', fetch());
        };

        registerSelectors([
            'global-micro-page-iFramed',
            'global-macro-page-Framed',
        ]);

        return {
            fetch,
            registerSelectors,
        }
        // EOC for iframeInventory
    })();


    // Todo => pattern && Dupe =› eventName
    // region/ apname/section/action/
    const eventsInventory = (() => {

        const targetedName = 'eventsInventory';
        logging.changeLogLevel({[targetedName]: [LogLevel.ERROR, LogLevel.WARN]});

        const delimiter = ['/', '-', '.'] // ToDo use delimiter to validate the pattern

        // scope{,region}/appname{,appType}/section/action/
        const defaultEventNames = [
            'global/web/error/generic',
            'global/web/error/404',
            'global/web/resource/unavailable',
            'global/system/service/unavailable',
            'global/system/access/unauthorized',
            'global/system/access/denied',
            'global/system/status/offline',
            'global/system/status/online',
            'global/module/load-status/init',
            'global/module/load-status/success',
            'global/module/load-status/error',
            'global/system/event/init',
            'global/system/iframe/init',
        ];

        let defaultRegister = [];
        let publicRegister = []; // exposed event by MFE, global scoped
        let privateRegister = []; // specific for MFE, local scoped // ToDo bind them to Dom Ref MFE-ID
        const obfuscatedRegister = {};


        const hashingEventName = (events) => {
            const unHashedEventNames = events.filter(
                (_eventName) => !obfuscatedRegister[_eventName]);
            unHashedEventNames.forEach((_eventName) => {
                obfuscatedRegister[_eventName] = $utils.hash(_eventName);
            });
        };

        const findHash = (eventName) => {
            if (privateRegister.includes(eventName)) {
                if (obfuscatedRegister[eventName]) return obfuscatedRegister[eventName]

                $console.error(targetedName, 'not allowed to use private register out of apps scope -', eventName);
                throw new Error(`globalAccessFault: event is not allowed the access outside it's scope : ${eventName}`);
                return eventName
            }
        };

        const findEventName = (hash) => {
            const eventName = Object.keys(obfuscatedRegister).find(
                (key) => obfuscatedRegister[key] === hash
            );

            if (eventName && privateRegister[eventName]) return eventName;

            return hash;
        }

        const presentInOtherRegister = (newEvents, register) => {

            const inOtherRegister = newEvents.filter((_eventName) =>
                register.includes(_eventName)
            );
            return inOtherRegister && inOtherRegister.length > 0;
        }

        const fetchDefault = () => defaultRegister;

        const fetchPublic = () => publicRegister;

        const fetchPrivate = () => privateRegister;

        const fetchEnlisted = () => [...fetchDefault(), ...fetchPublic()];

        const enlistDefault = (defaultEvents) => {
            defaultRegister = Array.from($utils.createSet(fetchDefault(), defaultEvents));
        };

        const enlistPublic = (publicEvents) => {
            if (presentInOtherRegister(publicEvents, fetchPrivate())) {
                throw new Error(`globalAccessFault: Multiple events aren't allowed to register`);
            }
            publicRegister = Array.from($utils.createSet(fetchPublic(), publicEvents));

            $console.all(targetedName, 'public events enlisted', publicRegister);
        };

        const enlistPrivate = (privateEvents) => {
            if (presentInOtherRegister(privateEvents, fetchPublic())) {
                throw new Error(`globalAccessFault: Multiple events aren't allowed to register`);
            }
            privateRegister = Array.from($utils.createSet(fetchPrivate(), privateEvents));

            hashingEventName(privateEvents);
            $console.all(targetedName, 'private events enlisted');
        }

        // Todo :: check for private event
        const isEventEnlisted = (eventName) => {
            // Todo special check based on caller of subscriber for private

            const isEnlisted =
                fetchDefault().includes(eventName) ||
                fetchPublic().includes(eventName) ||
                fetchPrivate().includes(eventName);

            $console.all(targetedName, `is event (${eventName}) enlisted :`, isEnlisted);

            return isEnlisted;
        }

        /**
         * Throw ERROR is Event Name not found in register
         * @param eventName
         * @param action
         * @param publishStatus
         */
        const check = (eventName, action, publishStatus) => {
            const matchedEventNames = [];
            if (isEventEnlisted(eventName)) {
                if (publishStatus && typeof publishStatus === 'function') {
                    // ToDo => remove from here catch and publish status as part of preprocessor
                    publishStatus(eventName, EVENT_STATUS_FAILED);
                    $console.error(targetedName, `${action ? `${action}` : ''} event: %c${eventName}%c failed`, 'font-weight:bold;', 'font-weight:unset;');

                    throw new Error(`globalAccessFault: ${action ? `${action}` : ''} event not recognised`);
                } else {
                    $console.log(targetedName, `${action ? `${action}` : ''} event: %c$(eventName)%c failed`, 'font-weight:bold;', 'font-weight:unset;');

                    return matchedEventNames;
                }
            }

            /** 1. ToDo => event name mapping from hash */
            /** 2. ToDo =› check for wildcard operation */

            matchedEventNames.push(eventName);
            $console.log(targetedName, 'inventory check successful');
            $console.all(targetedName, 'all the matched event by inventor check:', matchedEventNames);

            return matchedEventNames;
        };

        enlistDefault(defaultEventNames);

        return {
            fetchPublic,
            fetchEnlisted,
            enlistPublic,
            enlistPrivate,
            check,
            isEventEnlisted,
            findHash,
            findEventName,
        }
        // EOC for Event Inventory
    })();

    const eventUtils = (() => {
        const targetedName = "eventUtils";
        logging.changeLogLevel({[targetedName]: [LogLevel.ERROR, LogLevel.WARN]});


        /**
         * Process to check if evenData passed as Function
         *
         then call function and return data from response
         * @param eventData
         * @return (*}
         */
        const collectData = (eventData) => {
            $console.all(targetedName, 'check to see if event Data passed as callback function or JS pbject');
            let _eventData; // ToDo => check for promises as well
            if (typeof eventData === 'function') {
                _eventData = eventData();
            } else _eventData = eventData;

            return _eventData;
        }


        const createSyntheticEvent = (eventName, payload, timeStamp = $utils.getTimestamp(), eventSource = EVENT_SOURCE_PORTAL) => {
            $console.all(targetedName, `creating synthetic event for ${eventName}`);

            return new CustomEvent(eventName, {
                bubbles: true, // bubbling to allow an event from a child element, to support an ancestor catching it (optionally, with data)
                detail: {
                    eventName,
                    eventSource,
                    timeStamp,
                    payload: payload,
                }
            });
        }

        const createEventDetails = (source, eventDetails) => {
            return {
                detail: {
                    eventName: eventDetails?.eventName,
                    eventSource: source,
                    timeStamp: eventDetails?.timeStamp,
                    payload: eventDetails?.payload,
                },
            }
        }

        const dispatchingSyntheticOrPostingMessage = (elementRef, syntheticEvent, eventSource) => {

            try {
                elementRef.dispatchEvent(syntheticEvent);
                $console.all(targetedName, `Event was dispatched`, syntheticEvent);
                $console.log(targetedName, `Dispatched event => `, syntheticEvent?.eventName ?? '');
            } catch (error) {
                const {code, name} = error;
                $console.warn(targetedName, `ERROR in Dispatching, Posting it !!`);

                if (
                    CODE_DOM_EXCEPTION_SAME_ORIGIN === code ||
                    DOM_EXCEPTION_SAME_ORIGIN === name
                ) {
                    const eventDetails = syntheticEvent?.detail;
                    if (
                        eventDetails?.eventName &&
                        eventDetails?.eventName !== eventsInventory.findHash(eventDetails?.eventName)
                    )
                        throw new Error("globalAccessFault: We can't post private event to or from Iframe");

                    const forwardEventDetails = createEventDetails(eventSource, eventDetails);
                    elementRef.postMessage(forwardEventDetails, '*');

                    // Todo Need to adapt origin dynamically
                    $console.all(targetedName, `Event was posted :`, syntheticEvent);
                    $console.log(targetedName, `Posted event =>:`, syntheticEvent?.eventName ?? '');
                }
            }
        };

        return {
            collectData,
            createSyntheticEvent,
            dispatchingSyntheticOrPostingMessage,
        }
        // EOC for Event Utils
    })();

    const iframeEventHandler = (() => {
        const targetedName = 'iframeEventHandler';
        logging.changeLogLevel({[targetedName]: [LogLevel.ERROR, LogLevel.WARN]});


        const forwardingToParent = (syntheticEvent) => {
            $console.all(targetedName, `Dispatch(ing) from Iframe to Parent :`, syntheticEvent);
            activityTracker.post({
                ...syntheticEvent?.detail,
                invokedBy: targetedName,
                source: EVENT_SOURCE_IFRAME,
                target: EVENT_SOURCE_PARENT,
            });

            eventUtils.dispatchingSyntheticOrPostingMessage(window.parent, syntheticEvent, EVENT_SOURCE_IFRAME);

            $console.all(targetedName, `Dispatch(ed) from Iframe to Parent`, syntheticEvent);

        };

        const forwardingToIframe = (syntheticEvent) => {
            $console.all(targetedName, `Dispatch(ing) to Iframe from Parent :`, syntheticEvent);

            const iframes = document.querySelectorAll(iframeInventory.fetch().join(','));

            if (iframes.length === 0)
                $console.warn(targetedName, 'no matching frames found, follow guidelines for frame selectors pattern to use existing or register new selectors');

            iframes.forEach(function (iframeElement) {
                activityTracker.post({
                    ...syntheticEvent?.detail,
                    invokedBy: targetedName,
                    source: EVENT_SOURCE_PARENT,
                    target: iframeElement.className
                });
                eventUtils.dispatchingSyntheticOrPostingMessage(iframeElement.contentWindow, syntheticEvent, EVENT_SOURCE_PARENT);
            });

            $console.all(targetedName, `Dispatch(ed) to Iframe from Parent`, syntheticEvent);
        };

        /**
         * This helps to pass event between Iframe and parent in both directions
         * @param syntheticEvent
         */
        const forwardingToIframeOrParent = (syntheticEvent) => {
            $console.groupCollapsed(targetedName, LogLevel.LOG, 'Event Forwarding', syntheticEvent);

            if ($utils.isIframe()) {
                $console.log(targetedName, `Forwarding from Iframe to Parent :`);
                $console.groupEnd();
                forwardingToParent(syntheticEvent);
            } else {
                $console.log(targetedName, `Forwarding from Parent to Iframe:`);
                $console.groupEnd();
                forwardingToIframe(syntheticEvent);
            }
        };

        /**
         * This helps to listen posted message event in both direction from Parent to frame and vice versa.
         * Once event recognised at Parent or Iframe then matched registered subscribers get notified by executing all callbacks
         */
        const addingMessageEventListener = () => {
            $console.log(targetedName, 'adding message listener');
            window.addEventListener('message', (event) => {
                $console.all(targetedName, 'listening message event and executing all subscribers : ', event);

                // Todo Source check as well
                /**
                 * ToDo ?? should call publish internally instead of looking for callback
                 * Risk could be trapping into Infinite loop, if not handled properly
                 */
                subscribers.executing(event);
            });
        };

        const forwardPublicEventsInventory = (source, publicEvents = undefined) => {
            $console.log(targetedName, 'iframe event register forwarding', source);
            const syntheticEvent = eventUtils.createSyntheticEvent('global/system/iframe/init', {
                publicEvents: publicEvents ?? eventsInventory.fetchPublic(),
            });

            $console.all(targetedName, 'frame register forwarding event :', syntheticEvent);
            activityTracker.post({...syntheticEvent?.detail, invokedBy: targetedName, source,});
            forwardingToIframeOrParent(syntheticEvent);
        };

        return {
            forwardingToIframeOrParent,
            addingMessageEventListener,
            forwardPublicEventsInventory,
        }
        // EOC for iframeEventHandler
    })();

    const iframeHandshaking = (() => {

        const targetedName = 'iframeHandshaking';
        logging.changeLogLevel({[targetedName]: [LogLevel.WARN, LogLevel.LOG]});

        /**
         * subscribe to Frame Init event
         * @param source
         * @param forwardPublicEventsInventory
         * @private
         */
        const subscribeIframeInitEvent = (source, forwardPublicEventsInventory = false) => {
            $console.all(targetedName, 'subscribed frame init by : ', source);

            exposed.subscribe('global/system/iframe/init', (event) => {
                $console.log(targetedName, `${source} init subscribers executing`, event);

                if (event?.detail &&
                    Object.prototype.hasOwnProperty.call(event?.detail, 'payload')) {

                    $console.all(targetedName, `${source} init event has payload :`, event?.detail?.payload);

                    const {publicEvents} = event?.detail?.payload;

                    activityTracker.post({...event?.detail, invokedBy: targetedName, source});
                    if (publicEvents) eventsInventory.enlistPublic(publicEvents);

                    $console.all(targetedName, `${source} init subscriber added public events to it's train`);
                }

                $console.log(targetedName, 'check to forward Iframe init event :', forwardPublicEventsInventory);

                if (forwardPublicEventsInventory)
                    iframeEventHandler.forwardPublicEventsInventory(EVENT_SOURCE_PARENT);
            });
        };

        /**
         * Method to notify parent that Iframe train has loaded and parent acknowledges
         * Iframe post message with its Public Events and Parent registers Iframe public events in its register
         * and Parent acknowledges to Iframe by sending its Public events as well to Iframe
         * @private
         */
        const registerIframeTrainToParentTrain = () => {
            if ($utils.isIframe()) {
                $console.log(targetedName, 'frame registers to parent');
                iframeEventHandler.forwardPublicEventsInventory(EVENT_SOURCE_IFRAME);
            } else {
                $console.log(targetedName, 'parent creating subscribes to register iframe');
                subscribeIframeInitEvent(EVENT_SOURCE_PARENT, true);
            }
        };

        return {
            registerIframeTrainToParentTrain,
        };
        // EOC for iframeHandShaking
    })();

    const exposed = {
        /**
         * Event publish
         * @param (string} eventName
         * @param (object} eventData - configuration object with optional details
         * @param storeEventData, default is true to save the value in Latent data-store to be used by later subscribed event
         * @return no return value defined
         * @throws an ERROR if no event registry name/key is found
         */
        publish: (eventName, eventData = 0, storeEventData = true) => {
            $console.log(Exposed_Targets.publish, 'synthetic publishing : ', eventName);

            const [preProcessedEventName, preProcessedEventData] = processors.executePreProcessor(Exposed_Targets.publish, eventName, eventData);

            $console.log(Exposed_Targets.publish, 'publish Loading status');

            /** 1. publish Status for In-Progress*/
            exposed.publishStatus(preProcessedEventName, EVENT_STATUS_LOADING);
            $console.log(Exposed_Targets.publish, 'publish verification : ', preProcessedEventName);

            /** 2. verify event, throw ERROR if not found */
            const eventNames = eventsInventory.check(preProcessedEventName, 'published', exposed.publishStatus);

            /** 3, create event timestamp */
            const timeStamp = $utils.getTimestamp();

            $console.log(Exposed_Targets.publish, 'check to for function or JS object ', preProcessedEventData);

            /** 4. use eventData or call () to get eventData */
            const _eventData = eventUtils.collectData(preProcessedEventData);

            /** 5. create, dispatch and forward synthetic event for all matched events */
            eventNames.forEach((_eventName) => {

                /** 5.1 create synthetic event */
                const syntheticEvent = eventUtils.createSyntheticEvent(
                    eventsInventory.findHash(_eventName),
                    _eventData,
                    timeStamp
                );

                /** 5.2. dispatch global event */
                activityTracker.post({
                    ...syntheticEvent?.detail,
                    invokedBy: Exposed_Targets.publish,
                    source: EVENT_SOURCE_PORTAL,
                    target: EVENT_SOURCE_PORTAL
                });

                eventUtils.dispatchingSyntheticOrPostingMessage(window.document, syntheticEvent);

                // Todo event only bubble is we dispatch event using Dom Ref

                /** 5.3. forward event to or from iframe */
                iframeEventHandler.forwardingToIframeOrParent(syntheticEvent);
            });

            /** 6, publish Status for completion */
            // publishStatus(eventName,EVENT_STATUS_IDLE);
            $console.log(Exposed_Targets.publish, 'publish Idle status');

            processors.executePostProcessor(Exposed_Targets.publish,
                {eventName, preProcessedEventName},
                {eventData, preProcessedEventData}
            );
            $console.log(Exposed_Targets.publish, 'synthetic published');
        },

        publishStatus: (eventName, status) => {
            $console.log(Exposed_Targets.publishStatus, 'publish event($(eventName}) status :', status);

            const [preProcessedEventName, preProcessedStatus] = processors.executePreProcessor(
                Exposed_Targets.publishStatus,
                eventName,
                status
            );

            const statusEventName = `${preProcessedEventName}/status`.toString();

            $console.log(Exposed_Targets.publishStatus, 'publish status verification :', statusEventName);

            /**1. verify event, throw ERROR if not found */
            const statusEventNames = eventsInventory.check(statusEventName, 'status-published');

            /** 2. create, dispatch and forward Synthetic status event for all matched eventNames*/
            statusEventNames.forEach((_statusEventName) => {

                /** 2.1 create synthetic event*/
                const syntheticEvent = eventUtils.createSyntheticEvent(
                    eventsInventory.findHash(_statusEventName),
                    {
                        status: preProcessedStatus,
                    }
                );

                /** 2.2 dispatch synthetic event*/
                activityTracker.post({
                    ...syntheticEvent?.detail,
                    invokedBy: Exposed_Targets.publishStatus,
                    source: EVENT_SOURCE_PORTAL,
                    target: EVENT_SOURCE_PORTAL,
                });

                eventUtils.dispatchingSyntheticOrPostingMessage(
                    window.document,
                    syntheticEvent
                );

                /** 2.3 forward to or from iframe*/
                iframeEventHandler.forwardingToIframeOrParent(syntheticEvent);
            });

            processors.executePostProcessor(Exposed_Targets.publishStatus, {eventName, preProcessedEventName}, {
                status,
                preProcessedStatus
            });
            $console.log(Exposed_Targets.publishStatus, 'published status');
        },

        /**
         * Event subscription
         * @param (string} eventName
         * @param (function} callBack - callback invoked when event is published
         * @param lastPublishedData
         * @throws an ERROR if event inventory check fails (eventsInventory.check}
         */
        subscribe: (eventName, callBack, lastPublishedData = false) => {
            $console.log(Exposed_Targets.subscribe, 'subscribing event: ', eventName);

            const [preProcessedEventName, preProcessedCallback] = processors.executePreProcessor(
                Exposed_Targets.subscribe,
                eventName,
                callBack
            );

            $console.log(Exposed_Targets.subscribe, 'subscribing event verification: ', preProcessedEventName);

            /**1. verify event, throw ERROR if not found */
            const eventNames = eventsInventory.check(preProcessedEventName, 'subscribed', exposed.publishStatus);

            /** 2. subscribe for all matched events */
            eventNames.forEach((_eventName) => {
                const hash = eventsInventory.findHash(_eventName);

                activityTracker.post({
                    event: hash,
                    invokedBy: Exposed_Targets.subscribe,
                    source: EVENT_SOURCE_PORTAL,
                    target: EVENT_SOURCE_PORTAL,
                });

                /** 2.1 add callback to subscribers' list */
                subscribers.push(hash, preProcessedCallback);

                $console.log(Exposed_Targets.subscribe, `subscribers added for : ${_eventName}`);

                /** 2.2 add event listener */
                window.document.addEventListener(eventsInventory.findHash(_eventName), preProcessedCallback);

                $console.log(Exposed_Targets.subscribe, 'subscribers listener registered');
            });

            processors.executePostProcessor(
                Exposed_Targets.subscribe,
                {eventName, preProcessedEventName},
                {callBack, preProcessedCallback}
            );

            $console.log(Exposed_Targets.subscribe, 'subscribed : ', eventName);
        },

        /**
         * Subscribe to Published Event status
         * @param (string} eventName
         * @param (function} callBack - callback invoked as event goes through published stage
         * @throws an ERROR if event inventory check fails (eventsInventory.check}
         */
        subscribeStatus: (eventName, callBack) => {
            $console.log(Exposed_Targets.subscribeStatus, `status subscriber for event : ${eventName}`);

            const [preProcessedEventName, preProcessedCallback] =
                processors.executePreProcessor(
                    Exposed_Targets.subscribeStatus,
                    eventName,
                    callBack
                );

            $console.log(Exposed_Targets.subscribeStatus, 'subscribing status event verification: ', preProcessedEventName);

            /** 1. verify event, throw ERROR if not found */
            const eventNames = eventsInventory.check(preProcessedEventName, 'status-subscribed', exposed.publishStatus);

            /** 2. subscribe status event for all matched event */
            eventNames.forEach((_eventName) => {
                const isHashed = _eventName !== eventsInventory.findHash(_eventName);
                const statusEventName = `${_eventName}/status`;

                /** 2.1. register name for status */
                const enlist = isHashed
                    ? eventsInventory.enlistPrivate
                    : eventsInventory.enlistPublic;

                enlist([statusEventName]);

                if (!isHashed)
                    iframeEventHandler.forwardPublicEventsInventory(EVENT_SOURCE_PORTAL, statusEventName);

                $console.log(Exposed_Targets.subscribeStatus, 'subscribed status event registered : ', statusEventName);

                /** 2.2 add callback to subscribers' list */
                const hash = eventsInventory.findHash(statusEventName);

                activityTracker.post({
                    event: hash,
                    invokedBy: Exposed_Targets.subscribeStatus,
                    source: EVENT_SOURCE_PORTAL,
                    target: EVENT_SOURCE_PORTAL,
                });
                subscribers.push(hash, preProcessedCallback);

                $console.log(
                    Exposed_Targets.subscribeStatus,
                    'subscribed status event added :',
                    statusEventName
                );

                /** 2.3. add event listener */
                window.document.addEventListener(
                    eventsInventory.findHash(statusEventName),
                    preProcessedCallback
                );

                $console.log(
                    Exposed_Targets.subscribeStatus,
                    'subscribed status listener added :',
                    statusEventName
                );
            });
            processors.executePostProcessor(
                Exposed_Targets.subscribeStatus,
                {eventName, preProcessedEventName},
                {callBack, preProcessedCallback}
            );
        },

        /**
         * Event unSubscribe removes event listener
         * @param (string} eventName
         * @return no return value defined
         * @throws an ERROR if event inventory check fails (eventsInventory.check}
         */
        unsubscribe: (eventName) => {
            $console.log(
                Exposed_Targets.unsubscribe,
                'unsubscribing event',
                eventName
            );

            const [preProcessedEventName] = processors.executePreProcessor(
                Exposed_Targets.unsubscribe,
                eventName
            );

            $console.log(
                Exposed_Targets.unsubscribe,
                'unsubscribing event name verification :',
                eventName
            );

            /** 1. verify event, throw ERROR if not found */
            let eventNames = eventsInventory.check(
                preProcessedEventName,
                'unsubscribed',
                exposed.publishStatus
            );
            eventNames = eventNames.map((_eventName) =>
                eventsInventory.findHash(_eventName)
            );

            /** 2. clone subscribers array */
            const subscribersClone = subscribers.clone();

            /** 3. Update the subscribers with remaining which are still in game by filtering pit subscribed */
            subscribers.assign(
                subscribers.filter((eventName) => !eventNames.includes(eventName))
            );

            /** 4. remove listener for subscribed events */
            subscribersClone.forEach((subscriber) => {
                if (eventNames.includes(subscriber.eventName)) {
                    activityTracker.post({
                        event: subscriber.eventName,
                        invokedBy: Exposed_Targets.unsubscribe,
                        source: EVENT_SOURCE_PORTAL,
                        target: EVENT_SOURCE_PORTAL,
                    });
                    // remove event listeners and callbacks
                    window.document.removeEventListener(
                        subscriber.eventName,
                        subscriber.callBack
                    );
                }
            });

            $console.log(
                Exposed_Targets.unsubscribe,
                'unsubscribed event : ',
                eventName
            );

            processors.executePostProcessor(Exposed_Targets.unsubscribe, {
                eventName,
                preProcessedEventName,
            });
        },

        unsubscribeStatus: (eventName) => {
            $console.log(
                Exposed_Targets.unsubscribeStatus,
                'unsubscribing status event : ',
                eventName
            );

            const [preProcessedEventName] = processors.executePreProcessor(
                Exposed_Targets.unsubscribeStatus,
                eventName
            );

            const statusEventName = `$(preProcessedEventName)/status`.toString();

            $console.log(
                Exposed_Targets.unsubscribeStatus,
                'unsubscribing status event name verification : ',
                eventName
            );

            /** 1. verify event, throw ERROR if not found */
            const statusEventNames = eventsInventory.check(
                statusEventName,
                'status-unsubscribed'
            );

            statusEventNames.forEach((_statusEventName) => {
                activityTracker.post({
                    event: _statusEventName,
                    invokedBy: Exposed_Targets.unsubscribeStatus,
                    source: EVENT_SOURCE_PORTAL,
                    target: EVENT_SOURCE_PORTAL,
                });
                exposed.unsubscribe(_statusEventName);
            });

            $console.log(
                Exposed_Targets.unsubscribeStatus,
                'unsubscribed status event',
                eventName
            );

            processors.executePostProcessor(Exposed_Targets.unsubscribeStatus,
                {eventName, preProcessedEventName}
            );
        },

        /**
         * Event unSubscribe All removes all registered event listeners
         * and callbacks
         * empties list of subscribers
         * @return {undefined} - no return value defined
         */
        unsubscribeAll: () => {
            processors.executePreProcessor(Exposed_Targets.unsubscribeAll);

            subscribers.forEach((subscriber) => {
                activityTracker.post({
                    event: subscriber.eventName,
                    invokedBy: Exposed_Targets.unsubscribeAll,
                    source: EVENT_SOURCE_PORTAL,
                    target: EVENT_SOURCE_PORTAL,
                });
                window.document.removeEventListener(
                    subscriber.eventName,
                    subscriber.callBack
                );
            });

            subscribers.assign([]);

            $console.log(Exposed_Targets.unsubscribeAll, 'unsubscribed All');
            processors.executePostProcessor(Exposed_Targets.unsubscribeAll);
        },

        /**
         * This check if event is registered to Publish and Subscribed
         * @return (boolean] - true if a key or name is found
         * @return {boolean} - true if a key or name is found
         * @param eventName can be an event key or event name
         */
        isEventRegistered: (eventName) => eventsInventory.isEventEnlisted(eventName),

        /**
         * This method is provided to add only public events
         * @param (..*} publicEvents
         */
        registerPublicEvents: (publicEvents) => {
            $console.log(
                Exposed_Targets.registerPublicEvents,
                'registering public events',
                publicEvents
            );

            activityTracker.post({
                events: publicEvents,
                invokedBy: Exposed_Targets.registerPublicEvents,
                source: EVENT_SOURCE_PORTAL
            });
            eventsInventory.enlistPublic(publicEvents);

            $console.log(
                Exposed_Targets.registerPublicEvents,
                'dispatching new public events Between Iframe and Parent',
                publicEvents
            );

            iframeEventHandler.forwardPublicEventsInventory(EVENT_SOURCE_PORTAL);
        },

        /**
         * This method is provided to add only private events
         * @param (...*} privateEvents
         */
        registerPrivateEvents: (privateEvents) => {
            $console.log(
                Exposed_Targets.registerPrivateEvents,
                'registering private events'
            );

            activityTracker.post({
                invokedBy: Exposed_Targets.registerPrivateEvents,
                source: EVENT_SOURCE_PORTAL
            });
            eventsInventory.enlistPrivate(privateEvents);
        },

        /**
         * List all current registered events (default and public only)
         * @return {object} - list of registered event names
         */
        lookupRegisteredEvent: () => eventsInventory.fetchEnlisted(),

        /**
         * Todo ?? iframe selector registration, no two frames shall have same name
         * This method is provided to add only frame selectors
         * @param (..*} selectors
         */
        registerIFrameSelectors: (selectors) => iframeInventory.registerSelectors(selectors),

        /**
         * List all current registered frame selectors
         * @return (object} - list of selectors
         */
        lookupRegisteredIframeSelectors: () => iframeInventory.fetch(),

        addPreProcessors: (preProcessors) => processors.addPreProcessors(preProcessors),

        addPostProcessors: (postProcessors) => processors.addPostProcessors(postProcessors),

        changeLogLevel: (targetedLogLevels) => logging.changeLogLevel(targetedLogLevels),

        activities: () => activityTracker.showAll()
    };

    const createWagonInstance = (microAppName) => {
        if (!microAppName) {
            $console.error(
                Exposed_Targets.createWagonInstance,
                'Please specify the App Name while creating new wagon to Event Train'
            );
            throw new Error('globalInitFault: Please specify the App Name while creating new wagon to Event Train');
        }

        const existingWagons = wagons.filter((item) => item.name === microAppName);

        if (existingWagons.length > 0) {
            // $console.warn(
            // Exposed_ Targets.createWagonInstance,
            // `you have already wagon - $(appName} on Event Train. Avoid creating multiple wagons for same app, try to leverage one`
            // );
            // return;
            return {
                exposed,
            };
        }
        return new Wagon(microAppName);
    };

    // listen for frame Post Message events
    iframeEventHandler.addingMessageEventListener();

    // Frame Train registers itself to Parent Train
    iframeHandshaking.registerIframeTrainToParentTrain();

    Wagon.prototype = {constructor: Wagon};

    function Wagon(microAppName) {
        this.wagonHash =
            btoa(Math.random().toString(36)).slice(-7, -2) +
            btoa((+new Date).toString(36)).slice(-7, -2);

        // console.log(" wagon this for $(appName} : ', this);
        wagons.push({name: microAppName, hash: this.wagonHash});

        return {
            ...exposed,
        }
    }

    // ToDo =› create common method to extract info from payload

    let counter = 0;

    return {
        createWagonInstance,
        increment: () => {
            return (counter = counter + 5);
        },
        getCounter: () => {
            return counter;
        },
    };

// EOC for Event-Train
})(window, document);

// ToDo create UUID for each MFE loader which can then refer it with its ID only
// ToDo =› accept Event Name as List or String for Publish, Subscribe ...