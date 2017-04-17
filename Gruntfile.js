module.exports = function (grunt) {
  grunt.initConfig({
      coffee: {
        glob_to_multiple: {
          expand: true,
          cwd: 'src',
          src: ['**/*.coffee'],
          dest: 'lib',
          ext: '.js'
        }
      },
      copy: {
        main: {
          files: [
            {expand: true, cwd: 'src/views/', src: ['*'], dest: 'lib/views/', filter: 'isFile'},
            {expand: true, cwd: 'src/public/', src: ['*'], dest: 'lib/public/', filter: 'isFile'}
          ]
        }
      },
      watch: {
        files: ['**/*.coffee', 'src/views/*', 'src/public/*'],
        tasks: ['coffee', 'copy']
      }
    }
  )
  ;

  // Load tasks
  grunt.loadNpmTasks('grunt-contrib-coffee');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('default', ['coffee', 'copy']);
}
;