/* npm dependencies */
import React from 'react';
import classNames from 'classnames';

'use strict';

var ButtonState = {
  getDefaultProps: function() {
    return { stateful: true, size: '', btn: 'default' };
  },
  getInitialState: function() {
    return { pending: false };
  },
  pending: function() {
    return this.props.pending === undefined ? this.state.pending : this.props.pending;
  },
  getButtonText: function(defaultText) {
    return this.pending() ? (
      <i style={{position: 'initial'}} className="fa-li fa fa-spinner fa-spin"></i>
    ) : defaultText;
  },
  getButtonClass: function(type, size, pending) {
    var classList = {};
    classList['btn'] = true;
    if (type.toLowerCase() == 'primary') {
      classList['btn-primary'] = true;
    } else if (type.toLowerCase() == 'success') {
      classList['btn-success'] = true;
    } else if (type.toLowerCase() == 'switch') {
      classList['btn-switch'] = true;
    } else if (type.toLowerCase() == 'register') {
      classList['btn-register'] = true;
    } else {
      classList['btn-default'] = true;
    }
    if (size.toLowerCase() == 'large') {
      classList['btn-lg'] = true;
    } else if (size.toLowerCase() == 'small') {
      classList['btn-sm'] = true;
    }
    if (pending == true) {
      classList['disabled'] = true;
    } else {
      classList['disabled'] = false;
    }
    return classNames(classList);
  },
  onButtonClick: function(onClick, allowDefault) {
    return function(evt) {
      if (onClick) {
        /* if onClick function is provided, prevent default button action
         * and run the onClick function instead */
        if (!allowDefault) {
          evt.preventDefault();
        }
        if (this.props.stateful === false) {
          return onClick();
        }
      }
      this.setState({ pending: true }, function() {
        if (onClick) {
          onClick(function() {
            this.setState({ pending: false });
          }.bind(this));
        }
      }.bind(this));
    }.bind(this);
  },
};

// button that represents "pending" state as disabled, spinning
export default React.createClass({
  mixins: [ButtonState],
  render: function() {
    var className = this.props.className || '';
    return (
      <a {...this.props}
         href='javascript:'
         onClick={this.onButtonClick(this.props.onClick)}
         className={className + ' ' + this.getButtonClass(this.props.btn, this.props.size || '', this.pending())}>
        {this.getButtonText(this.props.children)}
      </a>
    );
  }
});

