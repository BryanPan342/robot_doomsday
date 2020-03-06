import {tiny, defs} from './common.js';

                                                  // Pull these names into this module's scope for convenience:
const { Triangle, Square, Tetrahedron, Windmill, Cube, Subdivision_Sphere } = defs;
// Pull these names into this module's scope for convenience:
const { vec3, vec4, vec, color, Mat4, Light, Shape, Material, Shader, Texture, Scene } = tiny;

class Robot {
  constructor(){
    this.location = 0;
    this.state = 0;
    this.linear_velocity = [0,0,0];
    this.time = 0;
    this.torso = 0;
    this.torso_prop = [0, 0];
    this.bottom_torso = 0;
    this.head = 0;
    this.head_prop = [0,0]
    this.left_arm = 0;
    this.left_hand = 0;
    this.right_arm = 0;
    this.right_hand = 0;
    this.arm_prop = [0,0];
  }
}

export class Shape_From_File extends Shape
{                                   // **Shape_From_File** is a versatile standalone Shape that imports
                                    // all its arrays' data from an .obj 3D model file.
  constructor( filename )
  { super( "position", "normal", "texture_coord" );
    // Begin downloading the mesh. Once that completes, return
    // control to our parse_into_mesh function.
    this.load_file( filename );
  }
  load_file( filename )
  {                             // Request the external file and wait for it to load.
    // Failure mode:  Loads an empty shape.
    return fetch( filename )
        .then( response =>
        { if ( response.ok )  return Promise.resolve( response.text() )
        else                return Promise.reject ( response.status )
        })
        .then( obj_file_contents => this.parse_into_mesh( obj_file_contents ) )
        .catch( error => { this.copy_onto_graphics_card( this.gl ); } )
  }
  parse_into_mesh( data )
  {                           // Adapted from the "webgl-obj-loader.js" library found online:
    var verts = [], vertNormals = [], textures = [], unpacked = {};

    unpacked.verts = [];        unpacked.norms = [];    unpacked.textures = [];
    unpacked.hashindices = {};  unpacked.indices = [];  unpacked.index = 0;

    var lines = data.split('\n');

    var VERTEX_RE = /^v\s/;    var NORMAL_RE = /^vn\s/;    var TEXTURE_RE = /^vt\s/;
    var FACE_RE = /^f\s/;      var WHITESPACE_RE = /\s+/;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      var elements = line.split(WHITESPACE_RE);
      elements.shift();

      if      (VERTEX_RE.test(line))   verts.push.apply(verts, elements);
      else if (NORMAL_RE.test(line))   vertNormals.push.apply(vertNormals, elements);
      else if (TEXTURE_RE.test(line))  textures.push.apply(textures, elements);
      else if (FACE_RE.test(line)) {
        var quad = false;
        for (var j = 0, eleLen = elements.length; j < eleLen; j++)
        {
          if(j === 3 && !quad) {  j = 2;  quad = true;  }
          if(elements[j] in unpacked.hashindices)
            unpacked.indices.push(unpacked.hashindices[elements[j]]);
          else
          {
            var vertex = elements[ j ].split( '/' );

            unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 0]);
            unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 1]);
            unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 2]);

            if (textures.length)
            {   unpacked.textures.push(+textures[( (vertex[1] - 1)||vertex[0]) * 2 + 0]);
              unpacked.textures.push(+textures[( (vertex[1] - 1)||vertex[0]) * 2 + 1]);  }

            unpacked.norms.push(+vertNormals[( (vertex[2] - 1)||vertex[0]) * 3 + 0]);
            unpacked.norms.push(+vertNormals[( (vertex[2] - 1)||vertex[0]) * 3 + 1]);
            unpacked.norms.push(+vertNormals[( (vertex[2] - 1)||vertex[0]) * 3 + 2]);

            unpacked.hashindices[elements[j]] = unpacked.index;
            unpacked.indices.push(unpacked.index);
            unpacked.index += 1;
          }
          if(j === 3 && quad)   unpacked.indices.push( unpacked.hashindices[elements[0]]);
        }
      }
    }
    {
      const { verts, norms, textures } = unpacked;
      for( var j = 0; j < verts.length/3; j++ )
      {
        this.arrays.position     .push( vec3( verts[ 3*j ], verts[ 3*j + 1 ], verts[ 3*j + 2 ] ) );
        this.arrays.normal       .push( vec3( norms[ 3*j ], norms[ 3*j + 1 ], norms[ 3*j + 2 ] ) );
        this.arrays.texture_coord.push( vec( textures[ 2*j ], textures[ 2*j + 1 ] ) );
      }
      this.indices = unpacked.indices;
    }
    this.normalize_positions( false );
    this.ready = true;
  }
  draw( context, program_state, model_transform, material )
  {               // draw(): Same as always for shapes, but cancel all
    // attempts to draw the shape before it loads:
    if( this.ready )
      super.draw( context, program_state, model_transform, material );
  }
}

export class Project_Base extends Scene
{                                          // **Transforms_Sandbox_Base** is a Scene that can be added to any display canvas.
                                           // This particular scene is broken up into two pieces for easier understanding.
                                           // The piece here is the base class, which sets up the machinery to draw a simple
                                           // scene demonstrating a few concepts.  A subclass of it, Transforms_Sandbox,
                                           // exposes only the display() method, which actually places and draws the shapes,
                                           // isolating that code so it can be experimented with on its own.
  constructor()
    {                  // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
      super();
      this.robots = [];
      this.hover = this.swarm = false;
      this.shapes = { 'box'  : new Cube(),
                      'ball' : new Subdivision_Sphere( 4 ),
                      "head": new Shape_From_File( "assets/Head.obj"),
                      "top_torso": new Shape_From_File( "assets/Top-Torso.obj"),
                      "bottom_torso": new Shape_From_File( "assets/Bottom-Torso.obj"),
                      "left_arm": new Shape_From_File( "assets/Left-Arm.obj"),
                      "left_hand": new Shape_From_File( "assets/Left-Hand.obj"),
                      "right_arm": new Shape_From_File( "assets/Right-Arm.obj"),
                      "right_hand": new Shape_From_File( "assets/Right-Hand.obj")};

      const phong = new defs.Phong_Shader();
      this.materials = { plastic: new Material( phong,
                                    { ambient: .2, diffusivity: 1, specularity: .5, color: color( .9,.5,.9,1 ) } ),
                        metal: new Material( phong,
                                    { ambient: .2, diffusivity: 1, specularity:  1, color: color( .9,.5,.9,1 ) } ),
                        robot_texture: new Material( new defs.Textured_Phong( 1 ),  { color: color( .5,.5,.5,1 ),
                                ambient: .3, diffusivity: .5, specularity: .5, texture: new Texture( "assets/R1_Color.jpg" )})};
    }
  make_control_panel()
    {                                 // make_control_panel(): Sets up a panel of interactive HTML elements, including
                                      // buttons with key bindings for affecting this scene, and live info readouts.
      this.control_panel.innerHTML += "Dragonfly rotation angle: <br>";
                                                // The next line adds a live text readout of a data member of our Scene.
      this.live_string( box => { box.textContent = ( this.hover ? 0 : ( this.t % (2*Math.PI)).toFixed(2) ) + " radians" } );
      this.new_line();
                                                // Add buttons so the user can actively toggle data members of our Scene:
      this.key_triggered_button( "Hover dragonfly in place", [ "h" ], function() { this.hover ^= 1; } );
      this.new_line();
      this.key_triggered_button( "Swarm mode", [ "m" ], function() { this.swarm ^= 1; } );
      this.robot_kill = 0;
      this.key_triggered_button( "Kill first robot", [ "m" ], function() { this.robots[this.robot_kill].state = 1; 
                                                                            this.robots[this.robot_kill].time = this.t; 
                                                                            this.robots[this.robot_kill].linear_velocity[0] = (Math.random() + 1) * 1.2; 
                                                                            this.robots[this.robot_kill].linear_velocity[1] = (Math.random() + 1) * 1.2; 
                                                                            this.robots[this.robot_kill].linear_velocity[2] = (Math.random() + 1) * 1.2; 
                                                                            this.robot_kill += 1; } );
    }

  display( context, program_state )
    {
      // "Constructor" statements would go within this if
      // We do it here instead of the constructor above so that we have access to context and program state
      if( !context.scratchpad.controls )
        {
          this.children.push( context.scratchpad.controls = new defs.Movement_Controls() );
          program_state.set_camera( Mat4.translation( 0,0,0 ) );

          // Get player location
          this.player_x = context.program_state.camera_inverse[0];
          this.player_y = context.program_state.camera_inverse[1];
          this.player_z = context.program_state.camera_inverse[2];
          this.d = context.program_state.camera_inverse[3];

          // Spawn all robots
          let robot1 = new Robot();
          this.robots.push(robot1);
          let robot2 = new Robot();
          this.robots.push(robot2);
          let robot3 = new Robot();
          this.robots.push(robot3);
          this.robots[0].location = Mat4.identity().times(Mat4.translation(0,0,-25)).times(Mat4.scale(0.5, 0.5, 0.5));
          this.robots[1].location = Mat4.identity().times(Mat4.translation(10,0,-45)).times(Mat4.scale(0.5, 0.5, 0.5));
          this.robots[2].location = Mat4.identity().times(Mat4.translation(-10,0,-45)).times(Mat4.scale(0.5, 0.5, 0.5));
          //  0 means alive - 1 means animate collapse - 2 means stay collapsed
        }

      // Default Required Variables
      program_state.projection_transform = Mat4.perspective( Math.PI/4, context.width/context.height, 1, 100 );
      const t = this.t = program_state.animation_time/1000;
      const angle = Math.sin( t );
      const light_position = Mat4.rotation( angle,   1,0,0 ).times( vec4( 0,-1,1,0 ) );
      program_state.lights = [ new Light( light_position, color( 1,1,1,1 ), 1000000 ) ];
    }

  draw_robot(context, program_state, index)
  {
    let robot_state = this.robots[index].state;
    // Alive
    if(robot_state == 0){
      // Calculate robot's planned path
      let x_location_diff = ((-1 * this.player_x[3]) - this.robots[index].location[0][3])/100;
      let y_location_diff = ((-1 * this.player_y[3]) - this.robots[index].location[1][3])/100;
      let z_location_diff = ((-1 * this.player_z[3]) - this.robots[index].location[2][3])/100;
      let euclidean_dist = 10 * Math.sqrt(Math.pow(x_location_diff, 2) + Math.pow(z_location_diff, 2));
      let x_rotation_angle  = 0.005 * Math.atan(x_location_diff/z_location_diff);

      // Set robot's planned path
      this.robots[index].location = this.robots[index].location
          .times(Mat4.rotation(x_rotation_angle, 0, 1, 0))
          .times(Mat4.translation(x_location_diff/euclidean_dist, 0, z_location_diff/euclidean_dist));
      var top_torso_transform = this.robots[index].location;
      this.robots[index].torso = this.robots[index].location;
      this.robots[index].torso = this.robots[index].location.times(Mat4.translation(0, 0, 0));
      this.robots[index].head = top_torso_transform.times(Mat4.translation(0, 2.9, 0));
      this.robots[index].bottom_torso = top_torso_transform.times(Mat4.rotation(Math.PI, 0, 1, 0))
          .times(Mat4.translation(0, -2.0, 0));
      this.robots[index].left_arm = top_torso_transform.times(Mat4.translation(2, 0, 0));
      this.robots[index].left_hand = top_torso_transform.times(Mat4.translation(2.9, -2.7, 0))
          .times(Mat4.scale(0.5, 0.5, 0.5));
      this.robots[index].right_arm = top_torso_transform.times(Mat4.translation(-2, 0, 0));
      this.robots[index].right_hand = top_torso_transform.times(Mat4.translation(-2.9, -2.7, 0))
          .times(Mat4.scale(0.5, 0.5, 0.5));
    }
    // Collapse
    else if(robot_state == 1){
      let broken_parts = 0;
      var top_torso_transform = this.robots[index].location;
      let t = (this.t - this.robots[index].time) * 1.5;
      let x = this.robots[index].linear_velocity[0] * t;
      let y = (-1) / 2 * 9.8 * t * t + this.robots[index].linear_velocity[1] * t;
      let z = this.robots[index].linear_velocity[2] * t;

      // Head collapse and bounce
      if(this.robots[index].head[1][3] < this.robots[index].location[1][3] - 1.3 && this.robots[index].head_prop[0] && (this.t - this.robots[index].head_prop[1]) > .5){
        broken_parts |= 1;
      }else if (this.robots[index].head[1][3] < this.robots[index].location[1][3] - 1.3 && this.robots[index].head_prop[0] == 0) {
        this.robots[index].head_prop[0] =  -1.7 * (this.robots[index].linear_velocity[1]- 9.8 * t);
        this.robots[index].head_prop[1] = this.t;
      }else{
        let t2 = (this.t - this.robots[index].head_prop[1]) * 1.5;
        let rebound = (-1) / 2 * 9.8 * t2 * t2 + this.robots[index].head_prop[0] * t2;
        let y1 = this.robots[index].head_prop[1] == 0 ? y : y + rebound;
        this.robots[index].head = top_torso_transform.times(Mat4.translation(x*.5, 2.9 + y1, z));
      }

      // torso collapse and bounce
      if(this.robots[index].torso[1][3] < this.robots[index].location[1][3] - 1 && this.robots[index].torso_prop[0] && (this.t - this.robots[index].torso_prop[1]) > .2){
        broken_parts |= 2;
      }else if (this.robots[index].torso[1][3] < this.robots[index].location[1][3] - 1 && this.robots[index].torso_prop[0] == 0) {
        this.robots[index].torso_prop[0] = 2* (this.robots[index].linear_velocity[1]- 9.8 * t);
        this.robots[index].torso_prop[1] = this.t;
      }else{
        console.log(this.robots[index]);
        let t2 = (this.t - this.robots[index].torso_prop[1]) * 1.5;
        let rebound = (-1) / 2 * 9.8 * t2 * t2 + this.robots[index].torso_prop[0] * t2;
        let y2 = this.robots[index].torso_prop[1] == 0 ? y : y + rebound;
        this.robots[index].torso = this.robots[index].location.times(Mat4.translation(-x*.5, y2 + rebound, -z));
        this.robots[index].bottom_torso = top_torso_transform.times(Mat4.rotation(Math.PI, 0, 1, 0))
          .times(Mat4.translation(0, -2.0, 0));
      }

      //Arm collapse and bounce
      if(this.robots[index].left_arm[1][3] < this.robots[index].location[1][3] - 1.2 && this.robots[index].arm_prop[0] && (this.t - this.robots[index].arm_prop[1]) > .2){
        broken_parts |= 1;
      }else if (this.robots[index].left_arm[1][3] < this.robots[index].location[1][3] - 1.2 && this.robots[index].arm_prop[0] == 0) {
        this.robots[index].arm_prop[0] =  -1.7 * (this.robots[index].linear_velocity[1]- 9.8 * t);
        this.robots[index].arm_prop[1] = this.t;
      }else{
        let t2 = (this.t - this.robots[index].arm_prop[1]) * 1.5;
        let rebound = (-1) / 2 * 9.8 * t2 * t2 + this.robots[index].arm_prop[0] * t2;
        let y3 = this.robots[index].arm_prop[1] == 0 ? y : y + rebound;
        this.robots[index].left_arm = top_torso_transform.times(Mat4.translation(2+x, y3, 0)).times(Mat4.rotation(Math.PI/3, 0, 0, 1));
        this.robots[index].left_hand = top_torso_transform.times(Mat4.translation(5.0+x, -.5+y3, 0))
          .times(Mat4.scale(0.5, 0.5, 0.5)).times(Mat4.rotation(Math.PI/3, 0, 0, 1));
        this.robots[index].right_arm = top_torso_transform.times(Mat4.translation(-2-x, y3, 0)).times(Mat4.rotation(Math.PI/3, 0, 0, -1));
        this.robots[index].right_hand = top_torso_transform.times(Mat4.translation(-5-x, -.5+y3, 0))
          .times(Mat4.scale(0.5, 0.5, 0.5)).times(Mat4.rotation(Math.PI/3, 0, 0, -1));
      }
      if(broken_parts == 8){
        this.robots[index].state = 2;
      }
    }

    // Draw Robot at robot_center
    this.shapes.head.draw( context, program_state, this.robots[index].head, this.materials.robot_texture);
    this.shapes.top_torso.draw( context, program_state, this.robots[index].torso, this.materials.robot_texture);
    this.shapes.bottom_torso.draw( context, program_state, this.robots[index].bottom_torso, this.materials.robot_texture);
    this.shapes.left_arm.draw( context, program_state, this.robots[index].left_arm, this.materials.robot_texture);
    this.shapes.left_hand.draw( context, program_state, this.robots[index].left_hand, this.materials.robot_texture);
    this.shapes.right_arm.draw( context, program_state, this.robots[index].right_arm, this.materials.robot_texture);
    this.shapes.right_hand.draw( context, program_state, this.robots[index].right_hand, this.materials.robot_texture);
  }
}


export class Project extends Project_Base
{
  display( context, program_state )
    {
      // Setup
      super.display( context, program_state );
      let model_transform = Mat4.identity();
      const t = this.t = program_state.animation_time/1000;

      // DEBUGGING
      // if ( this.player_x[0] !== context.program_state.camera_inverse[0][0] ||
      //       this.player_x[1] !== context.program_state.camera_inverse[0][1] ||
      //     this.player_x[2] !== context.program_state.camera_inverse[0][2] ||
      //     this.player_x[3] !== context.program_state.camera_inverse[0][3] ||
      //     this.player_y[0] !== context.program_state.camera_inverse[1][0] ||
      //     this.player_y[1] !== context.program_state.camera_inverse[1][1] ||
      //     this.player_y[2] !== context.program_state.camera_inverse[1][2] ||
      //     this.player_y[3] !== context.program_state.camera_inverse[1][3] ||
      //     this.player_z[0] !== context.program_state.camera_inverse[2][0] ||
      //     this.player_z[1] !== context.program_state.camera_inverse[2][1] ||
      //     this.player_z[2] !== context.program_state.camera_inverse[2][2] ||
      //     this.player_z[3] !== context.program_state.camera_inverse[2][3])
      // {
      //   console.log("Player: ", context.program_state.camera_inverse);
      //   console.log("Robot: ", this.robot_location);
      // }

      // Get Player's x, y, and z coordinates
      this.player_x = context.program_state.camera_inverse[0];
      this.player_y = context.program_state.camera_inverse[1];
      this.player_z = context.program_state.camera_inverse[2];

      // Ensure player cannot move in y-space
      context.program_state.camera_inverse = Mat4.translation(this.player_x[3], 0, this.player_z[3]);

      // Draw robot
      this.draw_robot(context, program_state, 0);
      this.draw_robot(context, program_state, 1);
      this.draw_robot(context, program_state, 2);
    }
}