/**
 * @author mrdoob / http://www.mrdoob.com
 */

var GPGPU = function ( renderer ) {

  var camera = new THREE.OrthographicCamera( - 0.5, 0.5, 0.5, - 0.5, 0, 1 );

  var scene = new THREE.Scene();

  var mesh = new THREE.Mesh( new THREE.PlaneBufferGeometry( 1, 1 ) );
  scene.add( mesh );

  this.render = function ( _scene, _camera, target ) {
    renderer.render( _scene, _camera, target, false );
  };

  this.pass = function ( shader, target ) {
    mesh.material = shader.material;
    renderer.render( scene, camera, target, false );
  };

  this.out = function ( shader ) {
    mesh.material = shader.material;
    renderer.render( scene, camera );
  };

};

var GPGPU2 = function ( renderer ) {
  var gl = renderer.context;
  var transformFeedback = gl.createTransformFeedback();

  this.pass = function ( shader, source, target ) {
    var sourceAttrib = source.attributes['position'];

    if (target.attributes['position'].buffer && sourceAttrib.buffer) {
      shader.bind();
      gl.enableVertexAttribArray( shader.attributes.position );
      gl.bindBuffer(gl.ARRAY_BUFFER, sourceAttrib.buffer);
      gl.vertexAttribPointer( shader.attributes.position, 4, gl.FLOAT, false, 16, 0 );

      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, target.attributes['position'].buffer);
      gl.enable(gl.RASTERIZER_DISCARD);
      gl.beginTransformFeedback(gl.POINTS);

      gl.drawArrays(gl.POINTS, 0, sourceAttrib.length / sourceAttrib.itemSize);

      gl.endTransformFeedback();
      gl.disable(gl.RASTERIZER_DISCARD);

      // Unbind the transform feedback buffer so subsequent attempts
      // to bind it to ARRAY_BUFFER work.
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);

      //gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, 0);
    }
  };
};
