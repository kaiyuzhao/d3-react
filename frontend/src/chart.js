// Chart.js

var d3chart = require('./d3chart');
var React = require('react')


var Chart = React.createClass({
  propTypes: {
    data: React.PropTypes.array,
    domain: React.PropTypes.object
  },

  componentDidMount: function() {
    var el = this.getDOMNode();
    d3chart.create(el, {
			width: 1000,
      height: 600
    }, this.getChartState());
  },

  componentWillReceiveProps: function() {
    var el = this.getDOMNode();
    // d3chart.update(el, this.getChartState());
  },

  getChartState: function() {
    return {
      data: this.props.data,
      domain: this.props.domain
    };
  },

  componentWillUnmount: function() {
    var el = this.getDOMNode();
    d3chart.destroy(el);
  },

  render: function() {
    return (
      <div className="Chart"></div>
    );
  }
});

module.exports = Chart;