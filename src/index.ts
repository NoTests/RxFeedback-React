import * as rx from 'rxjs';
import * as rxf from 'rxfeedback';
import * as React from 'react';

export type Callback<Event> = (event: Event) => void;

export type Renderer<State, Event> = (state: State, callback: Callback<Event>) => React.ReactNode;
export interface ReactFeedbackLoopFactory<State, Event> {
    (renderer: Renderer<State, Event>): rxf.FeedbackLoop<State, Event>;   
}

export type ReactFactory<State, Event> = (renderer: ReactFeedbackLoopFactory<State, Event>) => rx.Observable<State>;

class Binding<Event> extends rx.Subscription {
    events: rx.Observable<Event>;
    subscription: rx.Subscription;

    constructor(events: rx.Observable<Event>, subscription: rx.Subscription) {
        super();
        this.events = events;
        this.subscription = subscription;
    }

    unsubscribe(): void {
        this.subscription.unsubscribe();
    }
}

export class RootComponent<Props, State, Event> extends React.Component<Props, {}> {
    subscription: rx.Subscription | null;
    system: rx.Observable<State>;

    constructor(props: Props, factory: ReactFactory<State, Event>) {
        super(props);

        let reactFeedbackLoopFactory: ReactFeedbackLoopFactory<State, Event> = 
            (adapter): rxf.FeedbackLoop<State, Event> => {
                return (state: rx.Observable<State>, scheduler): rx.Observable<Event> => {
                    return rx.Observable.using(
                        () => {
                            const events = new rx.Subject<Event>();
                            const subscription = state.subscribe(
                                (x) => {
                                    const view = adapter(x, events.next.bind(events));
                                    this.setState(view as {});
                                }, 
                                events.error, 
                                events.complete
                            );

                            return new Binding<Event>(events, subscription);
                        }, 
                        (binding: Binding<Event>) => {
                            return binding.events;
                        }
                    ).observeOn(scheduler).subscribeOn(scheduler);
                };
            };

        this.system = factory(reactFeedbackLoopFactory);
    }

    componentDidMount() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }

        /* tslint:disable:no-empty */
        this.subscription = this.system.subscribe((_) => {}, console.log, console.log);
    }

    componentWillUnmount() {
        if (this.subscription) {
            this.subscription.unsubscribe();
            this.subscription = null;
        }
    }

    render() {
        return this.state || [];
    }
}