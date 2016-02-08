// d3Chart.js

var d3Chart = {};

d3Chart.create = function(el, props, state) {
  this.svg = d3.select(el).append('svg')
      .attr('width', props.width)
      .attr('height', props.height);

   this.update(el, state);
};

d3Chart.update = function(el, state) {
  // Re-compute the scales, and render the data points
  var scales = this._scales(el, state.domain);
  this._drawLines(el, scales, state.data);
};

d3Chart.destroy = function(el) {
  // Any clean-up would go here
  // in this example there is nothing to do
};



//draw lines
d3Chart._drawLines = function(el, scales, data) {
	if(!data) return null;
	if(!scales) return null;
	
	var svg = this.svg;
	
	svg
    .attr("width", 1000)
    .attr("height", 600);

		svg = svg.append('g');
			
		var d3line = d3.svg.line()
                    .x(function(d){return d.x;})
                    .y(function(d){return d.y;})
                    .interpolate("linear");
    //plot the data
    for(var i = 0; i < data.length; i++){
      svg.append("path").attr("d", d3line(data[i]))
          .style("stroke-width", 1)
          .style("stroke", "#ff2222")
          .style("fill", "none")
          .style('stroke-opacity',0.5);
    }
/*  var point = g.selectAll('.d3-point')
    .data(data, function(d) { return d.id; });

  // ENTER
  point.enter().append('circle')
      .attr('class', 'd3-point');

  // ENTER & UPDATE
  point.attr('cx', function(d) { return scales.x(d.x); })
      .attr('cy', function(d) { return scales.y(d.y); })
      .attr('r', function(d) { return scales.z(d.z); });

  // EXIT
  point.exit()
      .remove();*/
};

d3Chart._scales = function(el, domain) {
  if (!domain) {
    return null;
  }

  var width = el.offsetWidth;
  var height = el.offsetHeight;

  var x = d3.scale.linear()
    .range([0, width])
    .domain(domain.x);

  var y = d3.scale.linear()
    .range([height, 0])
    .domain(domain.y);

  var z = d3.scale.linear()
    .range([5, 20])
    .domain([1, 10]);

  return {x: x, y: y, z: z};
}

module.exports = d3Chart;