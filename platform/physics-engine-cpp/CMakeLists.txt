# FX KONTROL · Physics Engine (C++)
# High-precision aerodynamic simulation for drone flight
# by Minas FX

cmake_minimum_required(VERSION 3.20)
project(fxkontrol_physics VERSION 2.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Emscripten WASM target
if(EMSCRIPTEN)
  set(CMAKE_EXECUTABLE_SUFFIX ".js")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -s WASM=1 -s MODULARIZE=1 -s EXPORT_NAME=PhysicsEngine")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -s EXPORTED_FUNCTIONS='[_init,_update,_setWind,_getPosition]'")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -s EXPORTED_RUNTIME_METHODS='[ccall,cwrap]'")
endif()

add_executable(physics_engine
  src/physics_engine.cpp
  src/drone_physics.cpp
  src/aerodynamics.cpp
  src/pyro_physics.cpp
)

target_include_directories(physics_engine PRIVATE src/)
