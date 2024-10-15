(() => {
	const bgUrl = 'espaco.jpg';     // URL of the background image
	const blackholeMass = 100;      // Maximum mass for the black hole effect
	let curBlackholeMass = 0;       // Current mass, starts at 0 for animation
  
	let canvas, gl, program;        // Variables for canvas, WebGL context, and shader program
	let locationOfTime, locationOfResolution, locationOfMouse, locationOfMass; // Uniform locations
	let mouse = { x: 0, y: 0, moved: false }; // Mouse position and movement flag
	let startTime = Date.now();     // Start time of the simulation
	let currentTime = 0;            // Current elapsed time
  
	/**
	 * Initializes the WebGL context, shaders, buffers, and starts the render loop.
	 * @param {HTMLImageElement} image - The loaded background image.
	 */
	function init(image) {
	  canvas = document.getElementById('glscreen'); // Get the canvas element
	  gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl'); // Get the WebGL context
  
	  resizeCanvas(); // Set the canvas size to match the window
  
	  mouse.x = canvas.width / 2;   // Initialize mouse x-position to canvas center
	  mouse.y = canvas.height / 2;  // Initialize mouse y-position to canvas center
  
	  gl.viewport(0, 0, canvas.width, canvas.height); // Set the viewport to the canvas size
  
	  // Position buffer for drawing a rectangle over the entire canvas
	  const positionBuffer = gl.createBuffer();
	  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	  gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([
		  -1.0, -1.0, // Bottom-left corner
		   1.0, -1.0, // Bottom-right corner
		  -1.0,  1.0, // Top-left corner
		  -1.0,  1.0, // Top-left corner
		   1.0, -1.0, // Bottom-right corner
		   1.0,  1.0  // Top-right corner
		]),
		gl.STATIC_DRAW
	  );
  
	  // Retrieve shader source code from the HTML
	  const vertexShaderSource = document.getElementById('2d-vertex-shader').textContent;
	  const fragmentShaderSource = document.getElementById('2d-fragment-shader').textContent;
  
	  // Create and compile the shaders
	  const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
	  const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
  
	  // Create the shader program and use it
	  program = createProgram(vertexShader, fragmentShader);
	  gl.useProgram(program);
  
	  // Attribute locations for the shader program
	  const positionLocation = gl.getAttribLocation(program, 'a_position');
	  gl.enableVertexAttribArray(positionLocation);
	  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  
	  getLocations();   // Get uniform locations
	  setUniforms(image); // Set initial uniform values
  
	  addEventListeners(); // Add event listeners for interaction
	  render();            // Start the rendering loop
	}
  
	/**
	 * Creates and compiles a shader from the source code.
	 * @param {GLenum} type - The type of shader (vertex or fragment).
	 * @param {string} source - The GLSL source code for the shader.
	 * @returns {WebGLShader|null} - The compiled shader, or null if compilation failed.
	 */
	function createShader(type, source) {
	  const shader = gl.createShader(type);
	  gl.shaderSource(shader, source);
	  gl.compileShader(shader);
  
	  // Check if the shader compiled successfully
	  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error('Error compiling shader:', gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	  }
	  return shader;
	}
  
	/**
	 * Creates a shader program by linking the vertex and fragment shaders.
	 * @param {WebGLShader} vertexShader - The compiled vertex shader.
	 * @param {WebGLShader} fragmentShader - The compiled fragment shader.
	 * @returns {WebGLProgram|null} - The linked shader program, or null if linking failed.
	 */
	function createProgram(vertexShader, fragmentShader) {
	  const prog = gl.createProgram();
	  gl.attachShader(prog, vertexShader);
	  gl.attachShader(prog, fragmentShader);
	  gl.linkProgram(prog);
  
	  // Check if the program linked successfully
	  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
		console.error('Error linking program:', gl.getProgramInfoLog(prog));
		gl.deleteProgram(prog);
		return null;
	  }
	  return prog;
	}
  
	/**
	 * Retrieves the locations of uniform variables in the shader program.
	 */
	function getLocations() {
	  locationOfResolution = gl.getUniformLocation(program, 'u_resolution');
	  locationOfMouse = gl.getUniformLocation(program, 'u_mouse');
	  locationOfMass = gl.getUniformLocation(program, 'u_mass');
	  locationOfTime = gl.getUniformLocation(program, 'u_time');
	}
  
	/**
	 * Sets the uniform variables in the shader program.
	 * @param {HTMLImageElement} image - The background image to use as a texture.
	 */
	function setUniforms(image) {
	  gl.uniform2f(locationOfResolution, canvas.width, canvas.height); // Set resolution
	  gl.uniform2f(locationOfMouse, mouse.x, mouse.y);                 // Set mouse position
	  gl.uniform1f(locationOfMass, curBlackholeMass * 0.00001);        // Set mass
	  gl.uniform1f(locationOfTime, currentTime);                       // Set time
  
	  // Texture coordinate buffer for mapping the image onto the rectangle
	  const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
	  const texCoordBuffer = gl.createBuffer();
	  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
	  gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([
		  0.0, 0.0, // Bottom-left corner
		  1.0, 0.0, // Bottom-right corner
		  0.0, 1.0, // Top-left corner
		  0.0, 1.0, // Top-left corner
		  1.0, 0.0, // Bottom-right corner
		  1.0, 1.0  // Top-right corner
		]),
		gl.STATIC_DRAW
	  );
	  gl.enableVertexAttribArray(texCoordLocation);
	  gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
  
	  // Texture setup
	  const texture = gl.createTexture();
	  gl.bindTexture(gl.TEXTURE_2D, texture);
  
	  // Set texture parameters
	  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); // Prevent repeating
	  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); // Prevent repeating
	  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);    // Smooth scaling
	  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);    // Smooth scaling
  
	  // Upload the image into the texture
	  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
	}
  
	/**
	 * Adds event listeners for mouse movement and window resizing.
	 */
	function addEventListeners() {
	  // Update mouse position on mouse move
	  canvas.addEventListener('mousemove', (e) => {
		const rect = canvas.getBoundingClientRect();
		mouse.x = e.clientX - rect.left;                  // Calculate mouse x within canvas
		mouse.y = canvas.height - (e.clientY - rect.top); // Calculate mouse y within canvas (invert y-axis)
		mouse.moved = true;                               // Set mouse moved flag
	  });
  
	  // Adjust canvas size on window resize
	  window.addEventListener('resize', onResize);
	}
  
	/**
	 * Resizes the canvas to match the window dimensions and updates related settings.
	 */
	function resizeCanvas() {
	  canvas.width = window.innerWidth;
	  canvas.height = window.innerHeight;
	  gl.viewport(0, 0, canvas.width, canvas.height); // Update viewport
	  gl.uniform2f(locationOfResolution, canvas.width, canvas.height); // Update resolution uniform
	}
  
	/**
	 * Handler for the window resize event.
	 */
	function onResize() {
	  resizeCanvas(); // Call the resize function
	}
  
	/**
	 * The main render loop that updates and draws each frame.
	 */
	function render() {
	  currentTime = (Date.now() - startTime) / 1000; // Calculate elapsed time in seconds
  
	  // Gradually increase the black hole mass for a smooth animation
	  if (curBlackholeMass < blackholeMass - 50) {
		curBlackholeMass += (blackholeMass - curBlackholeMass) * 0.03; // Smooth increment
	  }
  
	  // If the mouse hasn't moved, animate the mouse position for a dynamic effect
	  if (!mouse.moved) {
		mouse.y = (canvas.height / 2) + Math.sin(currentTime * 0.7) * (canvas.height * 0.25);
		mouse.x = (canvas.width / 2) + Math.sin(currentTime * 0.6) * (canvas.width * 0.35);
	  }
  
	  // Update uniforms with the current values
	  gl.uniform1f(locationOfMass, curBlackholeMass * 0.00001); // Update mass
	  gl.uniform2f(locationOfMouse, mouse.x, mouse.y);          // Update mouse position
	  gl.uniform1f(locationOfTime, currentTime);                // Update time
  
	  // Draw the scene (two triangles forming a rectangle)
	  gl.drawArrays(gl.TRIANGLES, 0, 6);
	  requestAnimationFrame(render); // Request the next frame
	}
  
	// Start the simulation after the window has loaded
	window.addEventListener('load', () => {
	  const image = new Image();
	  image.crossOrigin = 'Anonymous'; // Allow cross-origin image loading
	  image.src = bgUrl;               // Set the source of the image
	  image.onload = () => init(image); // Initialize once the image has loaded
	});
  })();
  