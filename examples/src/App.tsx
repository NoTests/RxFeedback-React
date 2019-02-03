import * as React from 'react';
import * as rx from 'rxjs';
import * as rxf from 'rxfeedback';
import * as rxfr from './rxfeedback+react';
import { map, catchError } from 'rxjs/operators';

namespace CounterExample1 {
    type State = {
        value: number
    };
    type Event = 
        { kind: 'Increment' } |
        { kind: 'Decrement' };

    const initialState: State = {
        value: 0
    };

    function reduce(state: State, event: Event): State {
        switch (event.kind) {
        case 'Increment':
            return { value: state.value + 1 };
        case 'Decrement':
            return { value: state.value - 1 };
        default:
            return state;
        }
    }

    export class Component extends rxfr.RootComponent<{}, State, Event> {
        constructor(props: {}) {
            const factory: rxfr.ReactFactory<State, Event> = (uiFeedback): rx.Observable<State> => {
              return rxf.system(
                initialState,
                reduce,
                [
                    uiFeedback((state, sendEvent) => {
                        return (
                            <div>
                                <input 
                                    type="button" 
                                    value="-" 
                                    onClick={event => sendEvent({ kind: 'Decrement' })} 
                                />
                                {state.value}
                                <input 
                                    type="button" 
                                    value="+" 
                                    onClick={event => sendEvent({ kind: 'Increment' })} 
                                />
                            </div>
                        );
                  }),
                ]
              );
            };
        
            super(props, factory);
          }
    }
}

import * as GitHubApi from '@octokit/rest';
import * as http from 'http';
namespace GithubPaginatedSearchExample2 {

    type Repository =  {
        full_name: string,
        url: string
    };

    type State = {
        search: string,
        nextPageURL: GitHubApi.Link | null,
        shouldLoadNextPage: boolean,
        result: Repository[],
        lastError: string | null
    };
    type Response = 
        { kind: 'Success', repositories: Repository[], nextURL: GitHubApi.Link | null } |
        { kind: 'Failed', error: string };
    type Event = 
        { kind: 'Set', search?: string, shouldLoadNextPage?: boolean } |
        { kind: 'Response', response: Response };

    const initialState: State = {
        search: '',
        nextPageURL: null,
        shouldLoadNextPage: false,
        result: [],
        lastError: null
    };

    function reduce(state: State, event: Event): State {
       switch (event.kind) {
        case 'Set':
            return {
                ...state,
                search: event.search !== undefined ? event.search : state.search, 
                nextPageURL: event.search !== undefined ? null : state.nextPageURL,
                shouldLoadNextPage: event.shouldLoadNextPage !== undefined 
                    ? event.shouldLoadNextPage
                    : (event.search ? true : state.shouldLoadNextPage),
                result: event.search !== undefined ? [] : state.result,
            };
        case 'Response':
            switch (event.response.kind) {
            case 'Success':
                return {
                    ...state,
                    result: [...state.result, ...event.response.repositories],
                    nextPageURL: event.response.nextURL,
                    shouldLoadNextPage: false,
                    lastError: null
                };
            case 'Failed':
                return {
                    ...state,
                    lastError: event.response.error,
                    shouldLoadNextPage: false
                };
            default:
                return state;
            }
        default:
            return state;
        }
    }

    export class Component extends rxfr.RootComponent<{}, State, Event> {
        constructor(props: {}) {
            const factory: rxfr.ReactFactory<State, Event> = (uiFeedback): rx.Observable<State> => {
                const ui: rxf.FeedbackLoop<State, Event> = uiFeedback((state, sendEvent) => {
                    const repositories = state.result.map((x, index) => 
                        <li key={index}><a href={x.url}>{x.full_name}</a></li>);
                    return (
                        <div>
                            <input 
                                type="text" 
                                value={state.search}
                                placeholder="Search" 
                                onChange={event => sendEvent({ kind: 'Set', search: event.target.value })} 
                            />
                            <ul>
                            {repositories}
                            </ul>
                            {state.lastError}
                            {!state.shouldLoadNextPage
                                ? (state.search.length > 0 ? <input 
                                    type="button" 
                                    value="Load more ..." 
                                    onClick={event => sendEvent({ kind: 'Set', shouldLoadNextPage: true })} 
                                /> : '')
                                : 'Loading ...'
                            }
                        </div>
                    );
                });

                let api = new GitHubApi({
                    agent: new http.Agent()
                });
                type SearchDescriptor = { search: string, link: GitHubApi.Link | null };
                const loadRepositories: rxf.FeedbackLoop<State, Event> = rxf.Feedbacks.react(
                    (state): SearchDescriptor | null  =>
                        state.search.length > 0 && state.shouldLoadNextPage
                            ? { search: state.search, link: state.nextPageURL }
                            : null,
                    q => {
                        const query = q.link 
                            ? api.getNextPage(q.link)
                            : api.search.repos({ q: q.search });
                        return rx.from(query).pipe(
                            map((repos: GitHubApi.AnyResponse): Event => {
                                return {
                                    kind: 'Response',
                                    response: {
                                        kind: 'Success',
                                        // tslint:disable-next-line:no-string-literal
                                        repositories: repos.data['items'] as Repository[],
                                        // tslint:disable-next-line:no-string-literal
                                        nextURL: repos['meta'] as string
                                    }
                                };
                            }),
                            catchError((error: Error): rx.Observable<Event> => {
                                const event: Event = {
                                    kind: 'Response',
                                    response: {
                                        kind: 'Failed',
                                        error: (error || 'unknown').toString()
                                    }
                                };
                                return rx.of(event);
                            })
                        );
                    },
                    rxf.defaultRetryStrategy()
                );

                return rxf.system(
                    initialState,
                    reduce,
                    [
                        ui,
                        loadRepositories
                    ]
                );
            };
        
            super(props, factory);
          }
    }
}

class App extends React.Component { 
    render() {
        return (
            <div>
                <h1>A single example/state usually represents entire app, but multiple stores also work.</h1>
                <h1>Counter (Example 1)</h1>
                <CounterExample1.Component />
                <h1>GitHub Repository Search (Example 2)</h1>
                <GithubPaginatedSearchExample2.Component />
            </div>
        );
    }
}

export default App;
