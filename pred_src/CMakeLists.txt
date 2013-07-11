# CMake build file for the CUSF landing prediction software
#
# Original version: Rich Wareham <rjw57@cam.ac.uk>

# Use PkgConfig to find the glib libraries
find_package(PkgConfig)

pkg_check_modules(GLIB REQUIRED glib-2.0)

include_directories(${GLIB_INCLUDE_DIRS})
link_directories(${GLIB_LIBRARY_DIRS})

add_executable(pred
	util/gopt.c
	util/getdelim.c
	util/gopt.h
	util/getline.h
	util/getline.c
	util/getdelim.h
	altitude.h
	dataset.c
	dataset.h
	tawhiri_axes.c
	tawhiri_axes.h
	altitude.c
	pred.c
	run_model.c
	pred.h
	run_model.h
	ini/iniparser.c
	ini/iniparser.h
	ini/dictionary.h
	ini/dictionary.c
)

target_link_libraries(pred ${GLIB_LIBRARIES} -lm)

set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -Wall -Wno-long-long")
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -O2 -march=native -mtune=native")
set(CMAKE_EXE_LINKER_FLAGS "-s")
