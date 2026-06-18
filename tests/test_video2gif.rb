#!/usr/bin/env ruby
# test_video2gif.rb - Test the video2gif.rb script with different settings

require 'fileutils'
require 'json'
require_relative 'video2gif'

# Test class for Video2Gif
class TestVideo2Gif
  def initialize
    puts "\n\033[1;35m=== Starting Video2Gif Tests ===\033[0m"
    @original_config = JSON.parse(File.read('config.json')) if File.exist?('config.json')
    @test_configs = generate_test_configs
    @test_results = []
  end

  def generate_test_configs
    [
      {
        name: "Low Quality (128 colors)",
        config: {
          "max_width" => 800,
          "fps" => 2,
          "color_depth" => 128,
          "dither_method" => "bayer"
        }
      },
      {
        name: "Medium Quality (256 colors)",
        config: {
          "max_width" => 1200,
          "fps" => 3,
          "color_depth" => 256,
          "dither_method" => "sierra2_4a"
        }
      },
      {
        name: "High Quality (256 colors, Floyd-Steinberg)",
        config: {
          "max_width" => 1200,
          "fps" => 5,
          "color_depth" => 256,
          "dither_method" => "floyd_steinberg"
        }
      }
    ]
  end

  def run_tests
    # Create temp directory for test outputs
    FileUtils.mkdir_p('temp') unless Dir.exist?('temp')
    
    # Find a video file to test with
    video_files = Dir.glob('*.{mp4,MP4,mkv,MKV,avi,AVI,mov,MOV,wmv,WMV}')
    
    if video_files.empty?
      puts "❌ No video files found for testing"
      return false
    end
    
    test_video = video_files.first
    puts "🎬 Using #{test_video} for testing"
    
    @test_configs.each_with_index do |test_case, index|
      puts "\n\033[1;35m=== Test #{index + 1}: #{test_case[:name]} ===\033[0m"
      
      # Create test config file
      test_config = @original_config.dup || {}
      test_case[:config].each do |key, value|
        test_config[key] = value
      end
      
      test_config_path = "temp/test_config_#{index}.json"
      File.write(test_config_path, JSON.pretty_generate(test_config))
      
      # Copy test video to temp directory
      test_video_path = "temp/test_video_#{index}#{File.extname(test_video)}"
      FileUtils.cp(test_video, test_video_path)
      
      # Run Video2Gif with test config
      converter = Video2Gif.new('temp', test_config_path)
      
      # Process only the test video
      puts "⚙️ Processing with settings:"
      test_case[:config].each do |key, value|
        puts "  • #{key}: #{value}"
      end
      
      # Convert the test video
      converter.convert_to_gif(test_video_path)
      
      # Check if output exists
      output_path = test_video_path.sub(File.extname(test_video_path), '.gif')
      if File.exist?(output_path)
        size = File.size(output_path)
        @test_results << {
          name: test_case[:name],
          size: size,
          path: output_path
        }
        puts "✅ Test #{index + 1} passed: Output size: #{format_size(size)}"
      else
        puts "❌ Test #{index + 1} failed: No output file generated"
      end
    end
    
    # Print test summary
    print_summary
    
    true
  end
  
  def format_size(size_in_bytes)
    units = ['B', 'KB', 'MB', 'GB']
    unit_index = 0
    size = size_in_bytes.to_f
    
    while size >= 1024 && unit_index < units.length - 1
      size /= 1024
      unit_index += 1
    end
    
    "#{size.round(2)} #{units[unit_index]}"
  end
  
  def print_summary
    puts "\n\033[1;35m=== Test Results Summary ===\033[0m"
    
    if @test_results.empty?
      puts "❌ No successful tests"
      return
    end
    
    puts "📊 Size comparison:"
    @test_results.each do |result|
      puts "  • #{result[:name]}: #{format_size(result[:size])}"
    end
    
    # Find smallest and largest
    smallest = @test_results.min_by { |r| r[:size] }
    largest = @test_results.max_by { |r| r[:size] }
    
    puts "\n🏆 Results:"
    puts "  • Smallest file: #{smallest[:name]} (#{format_size(smallest[:size])})"
    puts "  • Largest file: #{largest[:name]} (#{format_size(largest[:size])})"
    
    size_diff = ((largest[:size] - smallest[:size]) / largest[:size].to_f * 100).round(2)
    puts "  • Size difference: #{size_diff}%"
  end
  
  def cleanup
    puts "\n🧹 Cleaning up test files..."
    FileUtils.rm_rf('temp') if Dir.exist?('temp')
    puts "✅ Cleanup complete"
  end
end

# Run the tests
begin
  tester = TestVideo2Gif.new
  tester.run_tests
  tester.cleanup
rescue => e
  puts "❌ Error during testing: #{e.message}"
  puts e.backtrace
ensure
  puts "\n\033[1;35m=== Tests Completed ===\033[0m"
end
