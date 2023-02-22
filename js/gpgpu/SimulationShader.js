/**
 * @author mrdoob / http://www.mrdoob.com
 */

function simulationCommon(maxColliders) {
  return [
    'uniform float timer;',
    'uniform vec4 colliders[' + maxColliders + '];',

    'float rand(vec2 co){',
    '  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);',
    '}',

    'vec4 runSimulation(vec4 pos) {',
    '  float x = pos.x + timer;',
    '  float y = pos.y;',
    '  float z = pos.z;',

    '  if (pos.w < 0.001 && pos.w > -0.001) {',
    '    pos.x += sin( y * 3.0 ) * cos( z * 11.0 ) * 0.005;',
    '    pos.y += sin( x * 5.0 ) * cos( z * 13.0 ) * 0.005;',
    '    pos.z += sin( x * 7.0 ) * cos( y * 17.0 ) * 0.005;',
    '  } else {',
    '    pos.y -= pos.w;',
    '    pos.w += 0.005;',
    '    if (pos.y < -2.0) {',
    '      pos.y += pos.w;',
    '      pos.w *= -0.3;',
    '    }',
    '  }',

    '  // Interaction with fingertips',
    '  for (int i = 0; i < ' + maxColliders + '; ++i) {',
    '    vec3 posToCollider = pos.xyz - colliders[i].xyz;',
    '    float dist = colliders[i].w - length(posToCollider);',
    '    if (dist > 0.0) {',
    '      pos += vec4(normalize(posToCollider) * colliders[i].w, 0.0);',
    '      pos.w = 0.01;', // Enable Gravity
    '    }',
    '  }',
    '  return pos;',
    '}',
  ].join('\n');
}

GPGPU.SimulationShader = function (maxColliders) {

  if (!maxColliders) maxColliders = 8;

  var material = new THREE.ShaderMaterial( {
    uniforms: {
      tPositions: { type: "t", value: texture },
      origin: { type: "t", value: texture },
      timer: { type: "f", value: 0 },
      colliders: { type: "4fv", value: null },
    },

    vertexShader: [
      'varying vec2 vUv;',

      'void main() {',
      '  vUv = vec2(uv.x, 1.0 - uv.y);',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
      '}',
    ].join('\n'),

    fragmentShader: [
      'varying vec2 vUv;',

      'uniform sampler2D tPositions;',
      'uniform sampler2D origin;',

      simulationCommon(maxColliders),

      'void main() {',
      '  vec4 pos = texture2D( tPositions, vUv );',
      '  pos.w = 0.0;',

      '  if ( rand(vUv + timer ) > 0.97 ) {',
      '    pos = vec4(texture2D( origin, vUv ).xyz, 0.0);',
      '  } else {',
      '    pos = runSimulation(pos);',
      '  }',

      '  // Write new position out',
      '  gl_FragColor = pos;',
      '}',
    ].join('\n'),
  } );

  return {

    material: material,

    setPositionsTexture: function ( positions ) {

      material.uniforms.tPositions.value = positions;

      return this;

    },

    setOriginsTexture: function ( origins ) {

      material.uniforms.origin.value = origins;

      return this;

    },

    setColliders: function ( colliders ) {

      material.uniforms.colliders.value = colliders;

      return this;

    },

    setTimer: function ( timer ) {

      material.uniforms.timer.value = timer;

      return this;

    }

  }

};

GPGPU.SimulationShader2 = function (renderer, maxColliders) {
  var gl = renderer.context;
  if (!maxColliders) maxColliders = 8;

  var attributes = {
    position: 0,
    origin: 1
  };

  function createProgram () {
    

    var vertexShader = gl.createShader( gl.VERTEX_SHADER );
    var fragmentShader = gl.createShader( gl.FRAGMENT_SHADER );

    gl.shaderSource( vertexShader, [
      'precision ' + renderer.getPrecision() + ' float;',

      'attribute vec4 position;',
      'attribute vec4 origin;',

      simulationCommon(maxColliders),

      'void main() {',
      '  vec4 pos = position;',

      '  if ( rand(position.xy + timer) > 0.97 ) {',
      '    pos = vec4(origin.xyz, 0.0);',
      '  } else {',
      '    pos = runSimulation(pos);',
      '  }',

      '  // Write new position out',
      '  gl_Position = pos;',
      '}'
    ].join( '\n' ) );

    gl.shaderSource( fragmentShader, [
      'precision ' + renderer.getPrecision() + ' float;',

      'void main() {',
        'gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);',
      '}'
    ].join( '\n' ) );

    gl.compileShader( vertexShader );
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error("Shader failed to compile", gl.getShaderInfoLog( vertexShader ));
      return null;
    }

    gl.compileShader( fragmentShader );
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error("Shader failed to compile", gl.getShaderInfoLog( fragmentShader ));
      return null;
    }

    var program = gl.createProgram();

    gl.attachShader( program, vertexShader );
    gl.attachShader( program, fragmentShader );

    gl.deleteShader( vertexShader );
    gl.deleteShader( fragmentShader );

    for (var i in attributes) {
      gl.bindAttribLocation( program, attributes[i], i );
    }

    gl.transformFeedbackVaryings( program, ["gl_Position"], gl.SEPARATE_ATTRIBS );

    gl.linkProgram( program );

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Shader program failed to link", gl.getProgramInfoLog( program ));
      gl.deleteProgram(program);
      return null;
    }

    return program;
  };

  var program = createProgram();

  if (!program) {
    return null;
  }

  var uniforms = {};
  var count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (var i = 0; i < count; i++) {
      uniform = gl.getActiveUniform(program, i);
      name = uniform.name.replace("[0]", "");
      uniforms[name] = gl.getUniformLocation(program, name);
  }

  var timerValue = 0;
  var collidersValue = null;

  var originBuffer = gl.createBuffer();

  return {
    program: program,

    attributes: attributes,

    bind: function() {
      gl.useProgram(program);
      gl.uniform1f(uniforms.timer, timer);
      gl.uniform4fv(uniforms.colliders, collidersValue);

      gl.enableVertexAttribArray( attributes.origin );
      gl.bindBuffer(gl.ARRAY_BUFFER, originBuffer);
      gl.vertexAttribPointer( attributes.origin, 4, gl.FLOAT, false, 16, 0 );
    },

    setColliders: function ( colliders ) {
      collidersValue = colliders;
    },

    setTimer: function ( timer ) {
      timerValue = timer;
    },

    setOriginData: function( data ) {
      gl.bindBuffer(gl.ARRAY_BUFFER, originBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    }

  }

};