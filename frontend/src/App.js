/* npm dependencies */
import React, {
	Component
}
from 'react';
import {
	Bar, Pie
}
from 'react-chartjs';
import Select from 'react-select';
import Color from 'color';
import LayerMixin from 'react-layer-mixin';
import d3 from 'd3';

/* intra-app dependencies */
import ps from './service';
import Button from './button';
//import edgebundling from './d3-ForceEdgeBundling';
import d3force from '../d3-ForceEdgeBundling'
//import D3chart from './d3chart';
import Chart from './chart'


'use strict';

import {
	LOADING
}
from './constants';
const LanguageColors = require('../language_colors.json');

function getLanguageColor(language) {
	let color = '#5e5555';
	if (language in LanguageColors) {
		color = LanguageColors[language].color;
		var cc = Color(color);
		color = cc.alpha(0.5).rgbString();

	}
	return color;
}

class SearchBox extends Component {
	constructor(props) {
		super(props);
		this.state = {
			value: ''
		};
	}
	onChange(evt) {
		this.setState({
			value: evt.target.value
		});
	}
  onSubmit(evt) {
    evt.preventDefault();
    const value = this.state.value;
    this.setState({value: ''}, () => {
      this.props.query(value);
    });
  }
	render() {
		return ( < div style = {
				{
					width: '100%'
				}
			} > < form style = {
				{
					display: 'inline-block',
					verticalAlign: 'middle'
				}
			}
			onSubmit = {
				this.onSubmit.bind(this)
			} > < input className = "form-control"
			type = "text"
			value = {
				this.state.value
			}
			onChange = {
				this.onChange.bind(this)
			}
			disabled = {
				this.props.pending
			}
			placeholder = {
				this.props.repo
			}
			/>
        </form > < Button btn = "primary"
			style = {
				{
					display: 'inline-block',
					marginLeft: 10
				}
			}
			onClick = {
				this.onSubmit.bind(this)
			}
			pending = {
				Boolean(this.props.pending)
			} >
			Search < /Button>
        <Button
          style={{float: 'right'}}
          onClick={this.props.query.bind(null, LOADING)}
          btn="primary"
        >
          Start Over
        </Button > < hr / > < /div>
    );
  }
}

var GraphLayout = React.createClass({
	getInitialState: function() {
		return {
			data: [],
			domain: {}
		}
	},
	//class GraphLayout extends Component {

	getVertexSize: function(vertex) {
		if (vertex.__id === this.props.repo) {
			return 4; // search term, center of neighborhood, make biggest
		} else {
			// all other vertices, weighted between 1 and 2,
			// scaled from min-max watchers
			return this.props.watcherScale(vertex.num_watchers);
		}
	},

	getEdgeId: function(edge) {
		return edge.__src_id + '_' + edge.__dst_id;
	},

	runSigma: function() {
		if (this.props.graph.verts && this.props.graph.edges) {
			if (this.s === undefined) {
				this.s = new sigma({
					graph: {
						nodes: [],
						edges: []
					},
					renderer: {
						container: this.refs.sigma_graph.getDOMNode(),
						type: 'canvas'
					},
					settings: {
						font: "Helvetica Neue",
						labelThreshold: 15,
						minNodeSize: 3,
						maxNodeSize: 20,
						sideMargin: 0.01,
						defaultLabelColor: 'rgba(94, 85, 85, 1)',
						edgesPowRatio: 0,
						nodesPowRatio: 0.3,
						minEdgeSize: 1,
						maxEdgeSize: 1,
						drawEdges: true
					}
				});
				this.s.bind('clickNode', e => {
					const repo = e.data.node.id;
					this.props.query(repo);
				});
			} else {
				this.s.graph.clear();
			}

			let visibleVertices = new Set();

			var eedges = [];
			var ebnodes = {};
			var min_x = Number.MAX_VALUE;
			var max_x = 0;
			var min_y = Number.MAX_VALUE;
			var max_y = 0;

			//loop over all the verts;
			this.props.graph.verts.forEach(vert => {
				if (this.props.hot &&
					(vert.__id !== this.props.repo && !vert.is_hot)) {
					// skip if "hot" filter is on, and this vertex is not hot,
					// and is not the focused repo.
					return;
				}
				if (this.props.language &&
					vert.__id !== this.props.repo && vert.language !== this.props.language) {
					// skip if language filter is on, and this vertex does not match,
					// and is not the focused repo.
					return;
				}
				visibleVertices.add(vert.__id);
				this.s.graph.addNode({
					id: vert.__id,
					label: vert.__id,
					x: vert.x,
					y: vert.y,
					size: this.getVertexSize(vert),
					color: getLanguageColor(vert.language)
				});
				var key = vert.__id;
				ebnodes[key] = {
					'x': vert.x,
					'y': vert.y
				};
				min_x = Math.min(min_x, vert.x);
				max_x = Math.max(max_x, vert.x);
				min_y = Math.min(min_y, vert.y);
				max_y = Math.max(max_y, vert.y);
			});
			//end of verts loop

			//loop over all the edges;
			this.props.graph.edges.forEach(edge => {
				const {
					__src_id: v1,
					__dst_id: v2
				} = edge;
				if (!visibleVertices.has(v1) || !visibleVertices.has(v2)) {
					// skip edges if both src and dst are not visible
					return;
				}
				this.s.graph.addEdge({
					id: this.getEdgeId(edge),
					source: edge.__src_id,
					target: edge.__dst_id,
					size: 1,
					color: 'rgba(0,0,0,0.1)'
				});
			});
			//end of edge loop

			var new_scale_x = d3.scale.linear().domain([min_x, max_x]).range([0, 1000]);
			var new_scale_y = d3.scale.linear().domain([min_y, max_y]).range([0, 600]);
			
			//for (var prop in ebnodes) {
			  //console.log("o." + prop + " = " + ebnodes[prop]);
				//}
			for (let key in ebnodes) {
			  if (ebnodes.hasOwnProperty(key)) {
					ebnodes[key].x = new_scale_x(ebnodes[key].x);
					ebnodes[key].y = new_scale_x(ebnodes[key].y);
				}
			}

			for (var i = 0; i < this.props.graph.edges.length; i++) {
				eedges.push({
					'source': this.props.graph.edges[i].__src_id,
					'target': this.props.graph.edges[i].__dst_id
				});
			}

			var fbundling = d3.ForceEdgeBundling().step_size(0.2).compatibility_threshold(0.6).nodes(ebnodes).edges(eedges);

			this.setState({
				data: fbundling(),
				domain: {
					x: [0, 1000],
					y: [0, 600]
				}
			});
			this.s.refresh();
		}
	},

	componentDidMount: function() {
		this.runSigma();
	},

	componentWillReceiveProps: function() {
		this.runSigma();
	},

	render: function() {
		console.log ( 'render' );
		return ( 
			<div className={'App'} style={{position:'relative'}}>
				<div style={{position:'absolute', top:0, left:0, height: 600, width: 1000 }}>
					<div style={{height: 600, width: 1000}} ref={"sigma_graph"}>
					</div>
			
			<div style={{position:'absolute', top:0, left:0, height: 600, width: 1000 }}>
			<div Chart data={this.state.data} domain={this.state.domain}/>
			</div>
			  </div>	
			</div>
		);
	}
});

class GraphContainer extends Component {
	constructor(props) {
		super(props);
		this.state = {
			hot: false,
			language: ''
		};
	}
	toggleHot() {
		this.setState({
			hot: !this.state.hot
		});
	}
	selectLanguage(language) {
		this.setState({
			language: language
		});
	}
	render() {
		if (this.props.error) {
			return ( < h3 > {
					this.props.error
				} < /h3>);
    }
    if (!this.props.graph.verts) {
      return (
        <div>
          <i className="fa fa-lg fa-spin fa-spinner" / > < /div>
      );
    }
		
    const numWatchers = this.props.graph.verts.map(v => v.num_watchers);
    const watcherScale = d3.scale.linear().domain([
      d3.min(numWatchers),
      d3.max(numWatchers)
    ]).range([0.2, 2]);
    return (
      <div style={{display: 'flex', flex: 1}}>
        <GraphLayout
          {...this.state}
          graph={this.props.graph}
          repo={this.props.repo}
          watcherScale={watcherScale}
          query={this.props.query}
        / > < RightBar {...this.state
				}
				graph = {
					this.props.graph
				}
				toggleHot = {
					this.toggleHot.bind(this)
				}
				selectLanguage = {
					this.selectLanguage.bind(this)
				}
				/>
      </div >
			);
		}
	}

	class TitleBar extends Component {
		render() {
			return ( <div style = {
					{
						width: '100%'
					}
				}> 
				<h2 style = {
					{
						display: 'inline-block',
						verticalAlign: 'middle'
					}
				}> GitHood | </h2>
        <h3 style={{display: 'inline-block', verticalAlign: 'middle'}}>&nbsp;GitHub Repository Neighborhood Recommender</h3 > < /div>
    );
  }
}


class PopularRepos extends Component {
	render() {
		const repos = [
			'numpy/numpy',
			'scikit-learn/scikit-learn',
			'dato-code/Dato-Core'
		];
		return ( < ul > {
				repos.map((repo, idx) => ( < li key = {
						idx
					} > < a href = "javascript:"
					onClick = {
						this.props.query.bind(null, repo)
					} > {
						repo
					} < /a > < /li >
				))
		} < /ul > );
	}
}

class FirstUX extends Component {
	submitQuery(evt) {
		evt.preventDefault();
		const query = this.refs.query.getDOMNode().value;
		this.props.query(query);
	}
	render() {
		return ( < div style = {
			{
				display: 'flex',
				flex: 1,
				alignItems: 'center',
				justifyContent: 'center'
			}
		} > < div > < h3 > Welcome to GitHood! < /h3 > < h3 > To get started, enter a GitHub username: < /h3 > < form onSubmit = {
							this.submitQuery.bind(this)
						} > < input type = "text"
						ref = "query" / > < /form>
          <h3>Or, choose from a set of popular repositories:</h3 > < PopularRepos query = {
							this.props.query
						}
						/>
        </div > < /div>
    );
  }
}


class Refinement extends Component {
  render() {
    const {languageCount} = this.props;
    const languageOptions = Object.keys(languageCount).sort((a,b) => {
      return languageCount[b] - languageCount[a];
    }).map(language => ({
      value: language, label: language
    }));
    return (
      <div>
        <h3>Refine By&hellip;</h3 > < div className = "form-control" > < input type = "checkbox"
						onChange = {
							this.props.toggleHot
						}
						checked = {
							this.props.hot
						}
						/>&nbsp;
          <label style={{fontWeight: 'normal'}}>&ldquo;Hot&rdquo; Repositories Only</label > < /div>
        <Select
          style={{width: '100%'}}
          placeholder="Language: All"
          value={this.props.language}
          options={languageOptions}
          onChange={this.props.selectLanguage}
        / > < /div>
    );
  }
}

class LanguageBreakdown extends Component {
  render() {
    const languageCount = this.props.languageCount;
    const chartData = Object.keys(languageCount).map(language => ({
      value: languageCount[language],
      color: getLanguageColor(language),
      label: language
    }));
    const chartOptions = {
      segmentShowStroke: false,
      animationSteps: 30
    };
    return (
      <div>
        <h3>Languages Used</h3 > < Pie data = {
							chartData
						}
						options = {
							chartOptions
						}
						/>
      </div >
					);
				}
			}

			class RightBar extends Component {
				render() {
					let languageCount = {};
					this.props.graph.verts.forEach(vert => {
						if (vert.language === null) {
							// bail out, no language for that repo
							return;
						}
						if (this.props.hot &&
							(vert.__id !== this.props.repo && !vert.is_hot)) {
							// bail out, repo is filtered out
							return;
						}
						if (vert.language in languageCount) {
							languageCount[vert.language]++;
						} else {
							languageCount[vert.language] = 1;
						}
					});
					return ( < div style = {
							{
								width: 300,
								borderLeft: '1px solid #eee',
								paddingLeft: 20
							}
						} > < Refinement {...this.props
						}
						languageCount = {
							languageCount
						}
						/>
        <hr / > < LanguageBreakdown {...this.props
						}
						languageCount = {
							languageCount
						}
						/>
      </div >
					);
				}
			}

			class MainUX extends Component {
				render() {
					const maxWatchers = this.props.graph.verts ? Math.max(this.props.graph.verts.map(v => v.num_watchers)) : 0;
					return ( < div style = {
							{
								display: 'flex',
								flexDirection: 'column',
								flex: 1
							}
						} > < SearchBox query = {
							this.props.query
						}
						pending = {
							this.props.pending
						}
						repo = {
							this.props.repo
						}
						/>
        <GraphContainer graph={this.props.graph} repo={this.props.repo} query={this.props.query} error={this.props.error} / > < /div>
    );
  }
}

class AppContainer extends Component {
  render() {
    const UIPane = this.props.repo === LOADING ? FirstUX : MainUX;
    return (
      <div style={{display: 'flex', flexDirection: 'column', padding: 20, height: '100%'}}>
        <TitleBar / > < UIPane {...this.props
						}
						/>
      </div >
					);
				}
			}

			export
			default class StateContainer extends Component {
				constructor(props) {
					super(props);
					this.state = {
						repo: LOADING,
						graph: {},
						error: null
					};
				}
				query(repo) {
					if (repo === LOADING) {
						this.setState({
							repo: LOADING,
							graph: {},
							error: null
						});
						return;
					}
					if (repo === this.state.repo && !this.state.error) {
						// no query needed
						return;
					}
					this.setState({
						repo: repo,
						graph: LOADING,
						error: null
					}, () => {
						ps.getNeighbors(repo, data => {
							if (typeof data === 'string') {
								this.setState({
									repo: '',
									error: data,
									graph: {}
								});
							} else {
								this.setState({
									graph: data
								});
							}
						});
					});
				}
				render() {
					return ( < AppContainer {...this.state
						}
						query = {
							this.query.bind(this)
						}
						pending = {
							this.state.graph === LOADING
						}
						/>
    );
  }
}
